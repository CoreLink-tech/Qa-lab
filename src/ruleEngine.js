const { checkSlowPages } = require("./rules/performanceRules");
const { checkSecurityHeaders } = require("./rules/securityRules");
const { checkHeadings } = require("./rules/seoRules");
const { checkImages } = require("./rules/accessibilityRules");
const { checkBrokenLinks } = require("./rules/linkRules");
const { checkForms } = require("./rules/formRules");

async function runRules(websiteModel) {

    let issues = [];

    console.log("Running Performance...");
    const performanceIssues = checkSlowPages(websiteModel);
    if (performanceIssues.length) {
        issues.push(...performanceIssues);
    }

    console.log("Running Security...");
    const securityIssues = checkSecurityHeaders(websiteModel);
    if (securityIssues.length) {
        issues.push(...securityIssues);
    }

    console.log("Running SEO...");
    const seoIssues = checkHeadings(websiteModel);
    if (seoIssues.length) {
        issues.push(...seoIssues);
    }

    console.log("Running Accessibility...");
    const accessibilityIssues = checkImages(websiteModel);
    if (accessibilityIssues.length) {
        issues.push(...accessibilityIssues);
    }

    console.log("Running Links...");
    const linkIssues = await checkBrokenLinks(websiteModel);
    if (linkIssues.length) {
        issues.push(...linkIssues);
    }

    console.log("Running Forms...");
    const formIssues = checkForms(websiteModel);
    if (formIssues.length) {
        issues.push(...formIssues);
    }

    console.log("Finished rules.");

    return issues;
}

module.exports = {
    runRules
};

