#!/usr/bin/env node
const { printSummary, printIssues } = require("./terminalReport");
const { createWebsiteModel } = require("./models/websiteModel");
const { crawlSite } = require("./siteCrawler");
const { normalizePage } = require("./normalizer");
const generateReport = require("./report");
const { runRules } = require("./ruleEngine");
const { calculateScore } = require("./scoring");
const { generateRecommendations } = require("./recommendations");
const { checkAssets } = require("./assetChecker");


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

    const options = {
        summary: args.includes("--summary"),
        issues: args.includes("--issues"),
        verbose: args.includes("--verbose"),
        quiet: args.includes("--quiet"),
        help: args.includes("--help"),
        json: args.includes("--json"),
        html: args.includes("--html"),
        checkAssets: args.includes("--check-assets"),
        ignoreRobots: args.includes("--ignore-robots"),
        useSitemap: args.includes("--use-sitemap")
    };

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

    generateReport(websiteModel);



    console.log("\n========== QA COMPLETE ==========");

    printSummary(websiteModel);

    if (options.issues) {
        printIssues(websiteModel);
    }
}

main();
