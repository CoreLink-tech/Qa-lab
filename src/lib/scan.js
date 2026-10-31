/**
 * QA Lab Scanner – programmatic library API
 *
 * This module exposes a clean, worker-friendly entry point so the NestJS
 * backend (or any other host) can run scans without going through process.argv
 * or depending on CLI side-effects (console output, process.exit, fixed
 * reports/ paths).
 *
 * The existing CLI (`src/index.js`) remains the supported command-line
 * interface and is not broken by these exports.
 *
 * @module lib/scan
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { createWebsiteModel } = require("../models/websiteModel");
const { crawlSite } = require("../siteCrawler");
const { normalizePage } = require("../normalizer");
const { runPerPageRules, collectSummaries, runFinalRules } = require("../ruleEngine");
const { loadRulesWithPlugins } = require("../core/ruleRegistry");
const { calculateScore } = require("../scoring");
const { generateRecommendations } = require("../recommendations");
const { aggregateFindings } = require("../findingAggregator");
const { checkAssets } = require("../assetChecker");
const { checkExposedPaths } = require("../exposedPathsChecker");
const { buildReportData } = require("../reportData");
const generateReport = require("../report");
const { createJsonReportWriter } = require("../jsonReportWriter");
const { assertSafeScanUrl } = require("../utils/ssrfGuard");

/**
 * @typedef {Object} ScanRequest
 * @property {string} startUrl
 * @property {number} [maxPages=100]
 * @property {number} [maxDepth=2]
 * @property {number} [timeoutMs]
 * @property {number} [concurrency=5]
 * @property {number} [delayMs=0]
 * @property {boolean} [respectRobotsTxt=true]
 * @property {boolean} [useSitemap=false]
 * @property {boolean} [includeExternalLinks=false]
 * @property {boolean} [checkExposedPaths=false]
 * @property {boolean} [checkAssets=false]
 * @property {string[]} [rules]
 * @property {string[]} [disabledRules]
 * @property {string[]} [rulesDirs]
 * @property {string} [userAgent]
 * @property {string} [scanId]
 * @property {string[]} [includePatterns]
 * @property {string[]} [excludePatterns]
 * @property {boolean} [writeReports=false] - if true, write JSON/HTML under reportsDir
 * @property {string} [reportsDir]
 * @property {(event: ScanProgressEvent) => void} [onProgress]
 * @property {AbortSignal} [signal] - for cancellation
 */

/**
 * @typedef {Object} ScanProgressEvent
 * @property {'started'|'page'|'rules'|'completed'|'failed'} type
 * @property {string} [scanId]
 * @property {number} [pagesScanned]
 * @property {string} [url]
 * @property {string} [message]
 * @property {Error} [error]
 */

/**
 * @typedef {Object} CategoryScore
 * @property {string} category
 * @property {number} score
 * @property {number} issueCount
 */

/**
 * @typedef {Object} ScanResult
 * @property {string} scanId
 * @property {string} startUrl
 * @property {string} startedAt
 * @property {string} completedAt
 * @property {'completed'|'failed'|'cancelled'|'partial'} status
 * @property {number} pagesScanned
 * @property {number} overallScore
 * @property {string} grade
 * @property {CategoryScore[]} [categories]
 * @property {object[]} findings - aggregated findings for display
 * @property {object[]} rawFindings - per-occurrence findings (for history/compare)
 * @property {object[]} recommendations
 * @property {object} summary
 * @property {object} [report] - { json?, html? } when writeReports or in-memory requested
 * @property {string} [error]
 */

/**
 * Derive a simple letter grade from overall score (mirrors scoring.js intent).
 * @param {number} score
 * @returns {string}
 */
function scoreToGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Run a full website QA scan programmatically.
 *
 * @param {ScanRequest} request
 * @returns {Promise<ScanResult>}
 */
async function scan(request) {
  if (!request || typeof request.startUrl !== "string" || !request.startUrl.trim()) {
    throw new Error("ScanRequest.startUrl is required");
  }

  const startUrl = request.startUrl.trim();
  // SSRF guard – mandatory for any programmatic / worker-driven scan
  await assertSafeScanUrl(startUrl, {
    allowHttp: true,
    resolveDns: true,
  });

  const scanId = request.scanId || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const startedAt = new Date().toISOString();
  const maxPages = Math.max(1, request.maxPages ?? 100);
  const maxDepth = Math.max(0, request.maxDepth ?? 2);
  const concurrency = Math.max(1, request.concurrency ?? 5);
  const delayMs = Math.max(0, request.delayMs ?? 0);
  const respectRobots = request.respectRobotsTxt !== false;
  const writeReports = Boolean(request.writeReports);
  const reportsDir = request.reportsDir
    ? path.resolve(request.reportsDir)
    : path.join(__dirname, "../../reports");

  const emit = (event) => {
    if (typeof request.onProgress === "function") {
      try {
        request.onProgress({ scanId, ...event });
      } catch (_) {
        /* swallow listener errors */
      }
    }
  };

  emit({ type: "started", message: `Starting scan of ${startUrl}` });

  try {
    // Load rules (plugins + built-ins). disabledRules / rules filter applied by registry if supported.
    const rules = await loadRulesWithPlugins({
      rulesDirs: request.rulesDirs || [],
      // future: enabled/disabled filters
    });

    const websiteModel = createWebsiteModel(startUrl);
    const siteContext = { url: startUrl };

    if (writeReports && !fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const jsonWriter = writeReports
      ? createJsonReportWriter(path.join(reportsDir, "report.json"), {
          schemaVersion: websiteModel.schemaVersion,
          url: websiteModel.url,
          timestamp: websiteModel.timestamp,
        })
      : null;

    let pageCount = 0;
    const allFindings = [];
    const summaries = {};
    const assetSourcePages = request.checkAssets ? [] : null;

    const { truncated, robotsBlockedCount } = await crawlSite(startUrl, {
      maxDepth,
      maxPages,
      concurrency,
      respectRobots,
      delayMs,
      useSitemap: Boolean(request.useSitemap),
      includePatterns: request.includePatterns,
      excludePatterns: request.excludePatterns,
      onPage: async (rawPage) => {
        if (request.signal?.aborted) {
          const err = new Error("Scan cancelled");
          err.name = "AbortError";
          throw err;
        }

        const page = normalizePage(rawPage, rawPage.html || "");
        pageCount++;

        const pageFindings = await runPerPageRules(page, rules, siteContext);
        allFindings.push(...pageFindings);
        collectSummaries(page, rules, summaries);

        if (jsonWriter) jsonWriter.writePage(page);

        if (assetSourcePages) {
          assetSourcePages.push({
            url: page.url,
            scripts: page.scripts,
            stylesheets: page.stylesheets,
            images: page.images,
          });
        }

        emit({
          type: "page",
          pagesScanned: pageCount,
          url: page.url,
          message: `Scanned ${page.url}`,
        });
      },
    });

    if (request.checkAssets && assetSourcePages) {
      const assetFindings = await checkAssets(assetSourcePages, { concurrency });
      allFindings.push(...assetFindings);
    }

    if (request.checkExposedPaths) {
      siteContext.exposedPathChecks = await checkExposedPaths(startUrl, { concurrency });
    }

    emit({ type: "rules", message: "Running final rules", pagesScanned: pageCount });

    const finalFindings = await runFinalRules(rules, summaries, siteContext);
    allFindings.push(...finalFindings);

    const aggregatedFindings = aggregateFindings(allFindings);
    const recommendations = generateRecommendations(aggregatedFindings);
    const score = calculateScore(allFindings);
    const grade = scoreToGrade(score);

    websiteModel.totalPages = pageCount;
    websiteModel.score = score;
    websiteModel.findings = allFindings;
    websiteModel.recommendations = recommendations;
    websiteModel.summary.pagesScanned = pageCount;
    websiteModel.summary.issuesFound = aggregatedFindings.length;

    let reportPayload = undefined;
    if (writeReports) {
      if (jsonWriter) {
        await jsonWriter.finalize({
          score,
          summary: { ...websiteModel.summary, issuesFound: aggregatedFindings.length },
          findings: aggregatedFindings,
          recommendations,
        });
      }
      // HTML / other formats
      generateReport(
        { ...websiteModel, findings: aggregatedFindings, recommendations },
        { formats: ["html"] }
      );
      reportPayload = {
        jsonPath: path.join(reportsDir, "report.json"),
        htmlPath: path.join(reportsDir, "report.html"),
      };
    }

    const completedAt = new Date().toISOString();
    const status = truncated ? "partial" : "completed";

    const result = {
      scanId,
      startUrl,
      startedAt,
      completedAt,
      status,
      pagesScanned: pageCount,
      overallScore: score,
      grade,
      findings: aggregatedFindings,
      rawFindings: allFindings,
      recommendations,
      summary: {
        ...websiteModel.summary,
        truncated: Boolean(truncated),
        robotsBlockedCount: robotsBlockedCount || 0,
      },
      report: reportPayload,
    };

    emit({ type: "completed", pagesScanned: pageCount, message: `Scan ${status}` });
    return result;
  } catch (err) {
    const completedAt = new Date().toISOString();
    const cancelled = err?.name === "AbortError" || request.signal?.aborted;
    emit({
      type: "failed",
      message: err.message,
      error: err,
    });
    return {
      scanId,
      startUrl,
      startedAt,
      completedAt,
      status: cancelled ? "cancelled" : "failed",
      pagesScanned: 0,
      overallScore: 0,
      grade: "F",
      findings: [],
      rawFindings: [],
      recommendations: [],
      summary: {},
      error: err.message || String(err),
    };
  }
}

module.exports = {
  scan,
  scoreToGrade,
};
