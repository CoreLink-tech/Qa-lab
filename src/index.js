#!/usr/bin/env node
const { printSummary, printIssues } = require("./terminalReport");
const { exportJSON } = require("./exporter");
const { scanWebsite } = require("./scanner");
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
    // Scan homepage
    const websiteResult = await scanWebsite(url);


    // Discover links
    const links = await crawlWebsite(url);


if (options.verbose) {
    console.log("\n========== DISCOVERED LINKS ==========\n");

    links.forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
    });

    console.log("\n========== PAGE TEST RESULTS ==========\n");
}

    const pages = [];


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

    const websiteModel = {

        url,

        pages,

        totalPages: pages.length,

        timestamp: new Date().toISOString(),

        findings: [],

        recommendations: [],

        score: 0,


        summary: {

            pagesScanned: pages.length,

            issuesFound: 0,


            severity: {

                critical: 0,

                high: 0,

                medium: 0,

                low: 0

            }

        }

    };



    console.log("Running QA Rules...");


    const issues = await runRules(websiteModel);



    console.log("Generating Recommendations...");


    const recommendations = generateRecommendations(issues);



    console.log("Calculating Score...");


    const score = calculateScore(issues);



    websiteResult.score = score;

    websiteResult.pagesScanned = pages.length;


    websiteModel.score = score;

    websiteModel.findings = issues;

    websiteModel.recommendations = recommendations;

    websiteModel.summary.issuesFound = issues.length;



    // Generate HTML + JSON Report

    generateReport(websiteModel);



    // Export final JSON model

    exportJSON(websiteModel);



console.log("\n========== QA COMPLETE ==========");

printSummary(websiteModel);

if (options.issues) {
    printIssues(websiteModel);
}
}

main();
