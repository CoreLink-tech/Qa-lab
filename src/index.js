#!/usr/bin/env node
const { printSummary, printIssues } = require("./terminalReport");
const { createWebsiteModel } = require("./models/websiteModel");
const { crawlWebsite } = require("./crawler");
const { scanPage } = require("./pageScanner");
const { normalizePage } = require("./normalizer");
const generateReport = require("./report");
const { runRules } = require("./ruleEngine");
const { calculateScore } = require("./scoring");
const { generateRecommendations } = require("./recommendations");


async function main() {

     const args = process.argv.slice(2);

const url = args.find(arg => !arg.startsWith("--"));

const options = {
    summary: args.includes("--summary"),
    issues: args.includes("--issues"),
    verbose: args.includes("--verbose"),
    quiet: args.includes("--quiet"),
    help: args.includes("--help"),
    json: args.includes("--json"),
    html: args.includes("--html")
};

if (options.help || !url) {
    console.log(`
QA-LAB

Usage:
node src/index.js <website> [options]

Options:
  --summary   Show scan summary
  --issues    Show issues in terminal
  --verbose   Print every scanned page
  --quiet     Show only final results
  --json      Export JSON report
  --html      Export HTML report
  --help      Show this help
`);
    process.exit(0);
}
    // Crawl homepage once: gives us both homepage page-data and the
    // links discovered on it, in a single request.
    const { homepage, links } = await crawlWebsite(url);


if (options.verbose) {
    console.log("\n========== DISCOVERED LINKS ==========\n");

    links.forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
    });

    console.log("\n========== PAGE TEST RESULTS ==========\n");
}

    const pages = [];

    // Homepage is page one, built from the crawl's own response instead
    // of fetching it again.
    const normalizedHomepage = normalizePage(homepage, homepage.html || "");
    pages.push(normalizedHomepage);

if (options.verbose) {
    console.log("--------------------------------------");
    console.log(`Page : ${normalizedHomepage.url}`);
    console.log(`Status : ${normalizedHomepage.status}`);
    console.log(`Response Time : ${normalizedHomepage.responseTime} ms`);
    console.log(`Title : ${normalizedHomepage.title}`);
}


    for (const link of links) {

        const page = await scanPage(url, link);


        const normalizedPage = normalizePage(
            page,
            page.html || ""
        );


        pages.push(normalizedPage);


if (options.verbose) {
    console.log("--------------------------------------");
    console.log(`Page : ${normalizedPage.url}`);
    console.log(`Status : ${normalizedPage.status}`);
    console.log(`Response Time : ${normalizedPage.responseTime} ms`);
    console.log(`Title : ${normalizedPage.title}`);
}
    }



    // Website Data Model

    const websiteModel = createWebsiteModel(url);

    websiteModel.pages = pages;
    websiteModel.totalPages = pages.length;
    websiteModel.summary.pagesScanned = pages.length;



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
