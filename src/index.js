#!/usr/bin/env node
const { printSummary, printIssues, printHistory, printComparison } = require("./terminalReport");
const { createWebsiteModel } = require("./models/websiteModel");
const { crawlSite } = require("./siteCrawler");
const { normalizePage } = require("./normalizer");
const generateReport = require("./report");
const { buildReportData } = require("./reportData");
const { runRules } = require("./ruleEngine");
const { calculateScore } = require("./scoring");
const { generateRecommendations } = require("./recommendations");
const { checkAssets } = require("./assetChecker");
const { saveScanToHistory, loadScanHistory, getPreviousFullScan } = require("./scanHistory");
const { compareScans } = require("./scanComparison");
const { evaluateQualityGate, isValidSeverity } = require("./qualityGate");


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
        ignoreRobots: args.includes("--ignore-robots"),
        useSitemap: args.includes("--use-sitemap"),
        history: args.includes("--history"),
        compare: args.includes("--compare"),
        noHistory: args.includes("--no-history")
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
  --fail-on=SEVERITY     Exit with code 1 if any finding at or above this severity
                         exists (critical, high, medium, low, or info). Intended
                         for CI quality gates. Reports are still written even on
                         failure. Off by default.
  --min-score=N          Exit with code 1 if the overall score is below N (0-100).
                         Composable with --fail-on -- either condition can fail
                         the gate. Off by default.
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

    if (options.history) {
        printHistory(loadScanHistory(url), url);
        process.exit(0);
    }

    const { pages: rawPages, truncated, robotsBlockedCount } = await crawlSite(url, {
        maxDepth: depth,
        maxPages,
        concurrency,
        respectRobots: !options.ignoreRobots,
        delayMs,
        useSitemap: options.useSitemap,
        includePatterns,
        excludePatterns
    });

    if (truncated) {
        console.log(`Crawl stopped early: hit the ${maxPages}-page limit before the site was fully crawled. Use --max-pages to raise it.`);
    }

    if (robotsBlockedCount > 0) {
        console.log(`Skipped ${robotsBlockedCount} link(s) disallowed by robots.txt. Use --ignore-robots to crawl them anyway.`);
    }

    const pages = rawPages.map(page => normalizePage(page, page.html || ""));

    if (options.verbose) {
        console.log("\n========== PAGES SCANNED ==========\n");
        pages.forEach(page => {
            console.log("--------------------------------------");
            console.log(`Page : ${page.url}`);
            console.log(`Depth : ${page.depth}`);
            console.log(`Status : ${page.status}`);
            console.log(`Response Time : ${page.responseTime} ms`);
            console.log(`Title : ${page.title}`);
        });
    }


    // Website Data Model

    const websiteModel = createWebsiteModel(url);

    websiteModel.pages = pages;
    websiteModel.totalPages = pages.length;
    websiteModel.summary.pagesScanned = pages.length;


    if (options.checkAssets) {
        websiteModel.assetChecks = await checkAssets(websiteModel, { concurrency });
    }


    console.log("Running QA Rules...");


    const issues = await runRules(websiteModel);



    console.log("Generating Recommendations...");


    const recommendations = generateRecommendations(issues);



    console.log("Calculating Score...");


    const score = calculateScore(issues);



    websiteModel.score = score;

    websiteModel.findings = issues;

    websiteModel.recommendations = recommendations;

    websiteModel.summary.issuesFound = issues.length;



    // Generate HTML + JSON Report

    generateReport(websiteModel, { formats, reportCategory });


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


    console.log("\n========== QA COMPLETE ==========");

    printSummary(websiteModel, formats);

    if (comparison) {
        printComparison(comparison);
    }

    if (options.issues) {
        printIssues(websiteModel);
    }

    if (failOnSeverity || minScore !== null) {
        const gate = evaluateQualityGate(score, { failOnSeverity, minScore });

        if (!gate.passed) {
            console.log("\n========== QUALITY GATE: FAILED ==========");
            gate.reasons.forEach(reason => console.log(`- ${reason}`));
            process.exit(1);
        }

        console.log("\n========== QUALITY GATE: PASSED ==========");
    }
}

main();
