#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { printSummary, printIssues, printHistory, printComparison } = require("./terminalReport");
const { createWebsiteModel } = require("./models/websiteModel");
const { crawlSite } = require("./siteCrawler");
const { normalizePage } = require("./normalizer");
const generateReport = require("./report");
const { buildReportData } = require("./reportData");
const { runPerPageRules, collectSummaries, runFinalRules } = require("./ruleEngine");
const { createJsonReportWriter } = require("./jsonReportWriter");
const { loadRulesWithPlugins } = require("./core/ruleRegistry");
const { calculateScore } = require("./scoring");
const { generateRecommendations } = require("./recommendations");
const { aggregateFindings } = require("./findingAggregator");
const { checkAssets } = require("./assetChecker");
const { checkExposedPaths } = require("./exposedPathsChecker");
const { saveScanToHistory, loadScanHistory, getPreviousFullScan } = require("./scanHistory");
const { compareScans } = require("./scanComparison");
const { evaluateQualityGate, isValidSeverity } = require("./qualityGate");
const { sendWebhooks } = require("./webhookNotifier");
const { generatePRComment } = require("./prComment");
const { generateDashboard } = require("./dashboardGenerator");


async function main() {

    const args = process.argv.slice(2);

    const url = args.find(arg => !arg.startsWith("--"));

    const DEFAULT_CONCURRENCY = 5;
    const DEFAULT_DEPTH = 2;
    const DEFAULT_MAX_PAGES = 100;

    const concurrencyArg = args.find(arg => arg.startsWith("--concurrency="));
    const concurrency = concurrencyArg
        ? Math.max(1, parseInt(concurrencyArg.split("=")[1], 10) || DEFAULT_CONCURRENCY)
        : DEFAULT_CONCURRENCY;

    const depthArg = args.find(arg => arg.startsWith("--depth="));
    const parsedDepth = depthArg ? parseInt(depthArg.split("=")[1], 10) : DEFAULT_DEPTH;
    const depth = Number.isNaN(parsedDepth) ? DEFAULT_DEPTH : Math.max(0, parsedDepth);

    const maxPagesArg = args.find(arg => arg.startsWith("--max-pages="));
    const maxPages = maxPagesArg
        ? Math.max(1, parseInt(maxPagesArg.split("=")[1], 10) || DEFAULT_MAX_PAGES)
        : DEFAULT_MAX_PAGES;

    const delayArg = args.find(arg => arg.startsWith("--delay="));
    const delayMs = delayArg ? Math.max(0, parseInt(delayArg.split("=")[1], 10) || 0) : 0;

    function compileRegexFlags(flagPrefix) {
        return args
            .filter(arg => arg.startsWith(flagPrefix))
            .map(arg => arg.slice(flagPrefix.length))
            .map(pattern => {
                try {
                    return new RegExp(pattern);
                } catch {
                    console.error(`Ignoring invalid pattern for ${flagPrefix}: ${pattern}`);
                    return null;
                }
            })
            .filter(Boolean);
    }

    const includePatterns = compileRegexFlags("--include=");
    const excludePatterns = compileRegexFlags("--exclude=");

    function collectFlagValues(flagPrefix) {
        return args
            .filter(arg => arg.startsWith(flagPrefix))
            .map(arg => arg.slice(flagPrefix.length));
    }

    const rulesDirs = collectFlagValues("--rules-dir=").map(dir => path.resolve(dir));
    const webhookUrls = collectFlagValues("--webhook=");

    const reportCategoryArg = args.find(arg => arg.startsWith("--report-category="));
    const reportCategory = reportCategoryArg ? reportCategoryArg.split("=")[1] : null;

    const failOnArg = args.find(arg => arg.startsWith("--fail-on="));
    const failOnSeverity = failOnArg ? failOnArg.split("=")[1] : null;

    const minScoreArg = args.find(arg => arg.startsWith("--min-score="));
    const minScore = minScoreArg ? Number(minScoreArg.split("=")[1]) : null;

    const options = {
        summary: args.includes("--summary"),
        issues: args.includes("--issues"),
        verbose: args.includes("--verbose"),
        quiet: args.includes("--quiet"),
        help: args.includes("--help"),
        json: args.includes("--json"),
        html: args.includes("--html"),
        csv: args.includes("--csv"),
        md: args.includes("--md"),
        executiveSummary: args.includes("--executive-summary"),
        checkAssets: args.includes("--check-assets"),
        checkExposedPaths: args.includes("--check-exposed-paths"),
        ignoreRobots: args.includes("--ignore-robots"),
        useSitemap: args.includes("--use-sitemap"),
        history: args.includes("--history"),
        compare: args.includes("--compare"),
        noHistory: args.includes("--no-history"),
        prComment: args.includes("--pr-comment"),
        dashboard: args.includes("--dashboard")
    };

    // If no format flags are given, default to json + html -- unchanged
    // from every prior version of this tool.
    const requestedFormats = [];
    if (options.json) requestedFormats.push("json");
    if (options.html) requestedFormats.push("html");
    if (options.csv) requestedFormats.push("csv");
    if (options.md) requestedFormats.push("md");
    if (options.executiveSummary) requestedFormats.push("executive");
    const formats = requestedFormats.length > 0 ? requestedFormats : ["json", "html"];

    if (options.help || !url) {
        console.log(`
QA-LAB

Usage:
node src/index.js <website> [options]

Options:
  --summary             Show scan summary
  --issues              Show issues in terminal
  --verbose              Print every scanned page
  --quiet                Show only final results
  --json                 Export JSON report
  --html                 Export HTML report
  --csv                  Export CSV report
  --md                   Export Markdown report
  --executive-summary    Export a condensed executive summary (Markdown)
  --report-category=CAT  Only include findings from one category (e.g.
                         Security, SEO, Accessibility) in generated reports
  --history              Show past scan results for this site instead of
                         running a new scan
  --compare              Run a scan, then compare it against the most
                         recent previous scan of this site (new/resolved
                         issues, score change)
  --no-history           Don't save this scan to history (saved by default --
                         this is local disk only, no extra requests to the
                         site being scanned)
  --concurrency=N        Max pages fetched in parallel (default: ${DEFAULT_CONCURRENCY})
  --depth=N              Max link-following depth from the start URL (default: ${DEFAULT_DEPTH})
  --max-pages=N          Safety cap on total pages crawled (default: ${DEFAULT_MAX_PAGES})
  --delay=MS             Minimum delay between requests, for politeness (default: 0)
  --ignore-robots        Don't respect robots.txt Disallow rules (respected by default)
  --use-sitemap          Also discover pages via sitemap.xml (off by default --
                         a sitemap can list far more pages than natural crawling
                         would find, changing scan scope and time significantly)
  --include=REGEX        Only crawl links matching this pattern (repeatable)
  --exclude=REGEX        Never crawl links matching this pattern (repeatable,
                         takes precedence over --include on conflicts)
  --check-assets         Fetch every unique script/stylesheet/image site-wide to
                         check for missing, oversized, or duplicate-content assets.
                         Off by default: adds real network requests beyond normal
                         page scanning, against whatever site you're scanning.
  --check-exposed-paths  Probe a fixed list of well-known sensitive paths (.env,
                         .git/config, backup files, directory listings, default
                         admin panels) to see if any are publicly reachable.
                         Purely passive: only checks response status/content of
                         static, well-known URLs -- never sends payloads, never
                         attempts authentication or exploitation of any kind.
                         Off by default: adds real network requests against
                         whatever site you're scanning. Only run this against
                         sites you own or are authorized to test.
  --fail-on=SEVERITY     Exit with code 1 if any finding at or above this severity
                         exists (critical, high, medium, low, or info). Intended
                         for CI quality gates. Reports are still written even on
                         failure. Off by default.
  --min-score=N          Exit with code 1 if the overall score is below N (0-100).
                         Composable with --fail-on -- either condition can fail
                         the gate. Off by default.
  --rules-dir=PATH       Load additional custom rules from this directory,
                         alongside the built-in rules (repeatable). Each rule
                         file follows the same {id, name, category, run()}
                         shape as a built-in rule.
  --webhook=URL          POST a JSON scan summary to this URL after the scan
                         completes (repeatable). Generic JSON payload -- not
                         a native Slack/Discord integration, which would need
                         their own specific payload format.
  --pr-comment           Write reports/pr-comment.md: a short Markdown summary
                         (score, grade, quality gate result if used) suitable
                         for posting as a CI pull request comment.
  --dashboard            Write reports/dashboard.html: a static page with a
                         score-over-time chart, built from this site's saved
                         scan history. Works even with --no-history (uses
                         whatever history already existed before this scan).
  --help                 Show this help
`);
        process.exit(0);
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("not http/https");
        }
    } catch {
        console.error(`"${url}" doesn't look like a valid http:// or https:// URL. Example: node src/index.js https://example.com`);
        process.exit(1);
    }

    if (failOnSeverity && !isValidSeverity(failOnSeverity)) {
        console.error(`"${failOnSeverity}" isn't a valid --fail-on severity. Use one of: critical, high, medium, low, info.`);
        process.exit(1);
    }

    if (minScoreArg && (Number.isNaN(minScore) || minScore < 0 || minScore > 100)) {
        console.error(`"--min-score=${minScoreArg.split("=")[1]}" must be a number between 0 and 100.`);
        process.exit(1);
    }

    for (const dir of rulesDirs) {
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            console.error(`--rules-dir "${dir}" doesn't exist or isn't a directory.`);
            process.exit(1);
        }
    }

    if (options.history) {
        printHistory(loadScanHistory(url), url);
        process.exit(0);
    }

    // --- Streaming pipeline ---------------------------------------------
    //
    // Every page is normalized, rule-checked, and (for the JSON report)
    // written to disk as soon as it's fetched, then discarded -- instead
    // of crawling the whole site into memory first and only THEN running
    // rules/writing reports. On a 1500+ page real-world crawl this was the
    // difference between an OOM crash and a clean run: holding every
    // page's full normalized data (headings/forms/links/scripts/
    // technologies) simultaneously for the whole rule-execution + report
    // phase was the dominant remaining cost even after raw HTML was
    // already stripped during normalization (see normalizer.js).
    //
    // Only small things survive the whole run: findings (one small object
    // per issue, not per page), each rule's own accumulated summaries
    // (currently just SEO's {url, title, description} for duplicate
    // detection), and -- only when --check-assets is used -- a lightweight
    // {url, scripts, stylesheets, images} extract per page (still far
    // smaller than a full normalized page).
    const rules = loadRulesWithPlugins(rulesDirs);
    const websiteModel = createWebsiteModel(url);
    const siteContext = { url };

    const reportsDir = path.join(__dirname, "../reports");
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const jsonWriter = formats.includes("json")
        ? createJsonReportWriter(path.join(reportsDir, "report.json"), {
            schemaVersion: websiteModel.schemaVersion,
            url: websiteModel.url,
            timestamp: websiteModel.timestamp
        })
        : null;

    let pageCount = 0;
    const allFindings = [];
    const summaries = {};
    const assetSourcePages = options.checkAssets ? [] : null;

    const { truncated, robotsBlockedCount } = await crawlSite(url, {
        maxDepth: depth,
        maxPages,
        concurrency,
        respectRobots: !options.ignoreRobots,
        delayMs,
        useSitemap: options.useSitemap,
        includePatterns,
        excludePatterns,
        onPage: async (rawPage) => {
            const page = normalizePage(rawPage, rawPage.html || "");
            pageCount++;

            const pageFindings = await runPerPageRules(page, rules, siteContext);
            allFindings.push(...pageFindings);
            collectSummaries(page, rules, summaries);

            if (jsonWriter) jsonWriter.writePage(page);

            // --check-assets needs every page's script/stylesheet/image
            // references to build its site-wide unique-asset list
            // (assetChecker.js), but not the rest of the page -- so only
            // these four small fields are kept, not the full page object.
            if (assetSourcePages) {
                assetSourcePages.push({
                    url: page.url,
                    scripts: page.scripts,
                    stylesheets: page.stylesheets,
                    images: page.images
                });
            }

            if (options.verbose) {
                console.log("--------------------------------------");
                console.log(`Page : ${page.url}`);
                console.log(`Depth : ${page.depth}`);
                console.log(`Status : ${page.status}`);
                console.log(`Response Time : ${page.responseTime} ms`);
                console.log(`Title : ${page.title}`);
            }
        }
    });

    if (options.verbose) {
        console.log("\n========== PAGES SCANNED ==========\n");
    }

    if (truncated) {
        console.log(`Crawl stopped early: hit the ${maxPages}-page limit before the site was fully crawled. Use --max-pages to raise it.`);
    }

    if (robotsBlockedCount > 0) {
        console.log(`Skipped ${robotsBlockedCount} link(s) disallowed by robots.txt. Use --ignore-robots to crawl them anyway.`);
    }

    if (options.checkAssets) {
        siteContext.assetChecks = await checkAssets({ pages: assetSourcePages }, { concurrency });
    }

    if (options.checkExposedPaths) {
        siteContext.exposedPathChecks = await checkExposedPaths(url, { concurrency });
    }

    console.log("Running QA Rules (final pass)...");

    const finalFindings = await runFinalRules(rules, summaries, siteContext);
    allFindings.push(...finalFindings);

    console.log("Aggregating Findings...");

    // Every rule emits one finding per occurrence (one per page, per
    // broken asset, etc.) -- correct for rules, but not what a human
    // wants to read: a header missing on 48 pages should show up as one
    // issue affecting 48 pages, not 48 near-identical rows. This is the
    // aggregated view used for every display-facing report and for
    // scoring's breadth calculation. It is NOT what gets stored for
    // history/--compare -- see the websiteModel.findings comment below.
    const aggregatedFindings = aggregateFindings(allFindings);

    console.log("Generating Recommendations...");

    const recommendations = generateRecommendations(aggregatedFindings);

    console.log("Calculating Score...");

    const score = calculateScore(allFindings);

    // websiteModel.pages is deliberately left empty here -- the JSON
    // report already has full per-page detail (streamed above), and
    // nothing else (HTML/CSV/MD/executive-summary reports, history,
    // comparison, webhooks, PR comments, the quality gate, scoring, or
    // recommendations) ever reads websiteModel.pages. Verified by
    // checking every consumer before making this change.
    //
    // websiteModel.findings is deliberately the RAW (non-aggregated)
    // findings, not aggregatedFindings -- scanComparison.js matches on
    // id + page to tell you "this exact issue on this exact page was
    // fixed", which needs per-page granularity. Aggregating here would
    // silently coarsen --compare from "8 of 48 pages still have this"
    // down to a meaningless "still exists somewhere" binary. Only the
    // DISPLAY reports (JSON/HTML/CSV/MD/executive/terminal, below) use
    // the aggregated view.
    websiteModel.totalPages = pageCount;
    websiteModel.score = score;
    websiteModel.findings = allFindings;
    websiteModel.recommendations = recommendations;
    websiteModel.summary.pagesScanned = pageCount;
    // Unique issue-type count, not raw occurrence count -- matches the
    // aggregated findings shown everywhere else (score's severity tally,
    // the reports, the history table). "48 occurrences of one issue"
    // should read as 1 issue found, same as it would to a human.
    websiteModel.summary.issuesFound = aggregatedFindings.length;

    if (jsonWriter) {
        const jsonFindings = reportCategory
            ? aggregatedFindings.filter(f => f.category === reportCategory)
            : aggregatedFindings;
        const jsonRecommendations = reportCategory
            ? recommendations.filter(r => r.category === reportCategory)
            : recommendations;

        await jsonWriter.finalize({
            score,
            summary: { ...websiteModel.summary, issuesFound: jsonFindings.length },
            findings: jsonFindings,
            recommendations: jsonRecommendations
        });
        console.log("\nReports generated:");
        console.log("reports/report.json");
    }

    // A display-only model: findings/recommendations swapped for the
    // aggregated view, used for every human-facing output (report files
    // and the terminal summary below). websiteModel itself (used for
    // history/--compare) keeps the raw findings untouched -- see the
    // comment above websiteModel.findings for why.
    const displayModel = { ...websiteModel, findings: aggregatedFindings, recommendations };

    const otherFormats = formats.filter(f => f !== "json");
    if (otherFormats.length > 0) {
        generateReport(displayModel, { formats: otherFormats, reportCategory });
    }

    // History/comparison always use the full, unfiltered scan data --
    // independent of --report-category, so a filtered report run doesn't
    // silently narrow what future --history/--compare calls see.
    const fullReportData = buildReportData(websiteModel);

    let comparison = null;
    if (options.compare) {
        const previousScan = getPreviousFullScan(url, fullReportData.timestamp);
        comparison = compareScans(previousScan, fullReportData);
    }

    if (!options.noHistory) {
        saveScanToHistory(fullReportData);
    }

    if (options.dashboard) {
        const history = loadScanHistory(url);
        const dashboardPath = path.join(__dirname, "../reports/dashboard.html");
        fs.writeFileSync(dashboardPath, generateDashboard(history, url));
        console.log("reports/dashboard.html");
    }


    console.log("\n========== QA COMPLETE ==========");

    printSummary(displayModel, formats, pageCount);

    if (comparison) {
        printComparison(comparison);
    }

    if (options.issues) {
        printIssues(displayModel);
    }

    let gate = null;
    if (failOnSeverity || minScore !== null) {
        gate = evaluateQualityGate(score, { failOnSeverity, minScore });
    }

    // PR comment and webhooks fire regardless of gate pass/fail -- same
    // reasoning as reports still being written on a failing gate: a CI
    // consumer needs to know a scan failed, not just silently get nothing.
    if (options.prComment) {
        const commentPath = path.join(__dirname, "../reports/pr-comment.md");
        fs.writeFileSync(commentPath, generatePRComment(fullReportData, gate));
        console.log("\nreports/pr-comment.md");
    }

    if (webhookUrls.length > 0) {
        const results = await sendWebhooks(webhookUrls, fullReportData, gate);
        results.forEach(result => {
            console.log(
                result.success
                    ? `Webhook delivered: ${result.url}`
                    : `Webhook failed (${result.url}): ${result.error}`
            );
        });
    }

    if (gate) {
        if (!gate.passed) {
            console.log("\n========== QUALITY GATE: FAILED ==========");
            gate.reasons.forEach(reason => console.log(`- ${reason}`));
            process.exit(1);
        }

        console.log("\n========== QUALITY GATE: PASSED ==========");
    }
}

main();
