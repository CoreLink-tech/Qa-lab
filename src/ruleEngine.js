const { loadRules } = require("./core/ruleRegistry");

async function runRules(websiteModel, rules = loadRules()) {

    let issues = [];

    for (const rule of rules) {

        console.log(`Running ${rule.name}...`);

        try {
            // await works whether run() is sync or async, so rules
            // that need to do their own network calls (e.g. link
            // checking) don't need special-casing here.
            const findings = await rule.run(websiteModel);

            if (findings && findings.length) {
                issues.push(...findings);
            }

        } catch (error) {
            console.error(
                `Rule "${rule.id}" (${rule.name}) threw an error and was skipped: ${error.message}`
            );
        }
    }

    console.log("Finished rules.");

    return issues;
}

// --- Streaming rule contract (used for large crawls) ---------------------
//
// runRules() above requires the entire websiteModel.pages array to be
// materialized in memory before a single rule can run. For large crawls
// (thousands of pages) that's the dominant source of peak memory use, even
// after html is stripped -- every page's headings/forms/links/scripts/
// technologies still gets held for every page simultaneously.
//
// Most rules only ever look at one page in isolation. A rule can now
// export any combination of:
//   - runPerPage(page, siteContext)   called once per page, immediately
//     after normalization, before the page is discarded. Returns findings.
//   - collectSummary(page)            called once per page (if present),
//     returns a small object accumulated across the whole run for rules
//     that need cross-page comparison (e.g. duplicate titles) without
//     needing the full page object to survive.
//   - runFinal(summaries, siteContext) called once after all pages are
//     processed, given this rule's own accumulated summaries (empty array
//     if the rule has no collectSummary) plus siteContext (site-level
//     precomputed data like assetChecks/exposedPathChecks/url -- NOT the
//     full pages array). Returns findings.
//
// A rule that only implements runPerPage never needs any cross-page state
// held in memory at all. Only the (few) rules that implement collectSummary
// pay for cross-page memory, and only for the small fields they ask for.

async function runPerPageRules(page, rules, siteContext = {}) {
    const findings = [];

    for (const rule of rules) {
        if (typeof rule.runPerPage !== "function") continue;

        try {
            const result = await rule.runPerPage(page, siteContext);
            if (result && result.length) findings.push(...result);
        } catch (error) {
            console.error(
                `Rule "${rule.id}" (${rule.name}) threw during runPerPage and was skipped for ${page.url}: ${error.message}`
            );
        }
    }

    return findings;
}

// summaries: a plain object keyed by rule id, each value the running array
// of that rule's collectSummary() results so far. Mutated in place (small,
// cheap, intended to be reused across the whole crawl).
function collectSummaries(page, rules, summaries) {
    for (const rule of rules) {
        if (typeof rule.collectSummary !== "function") continue;

        if (!summaries[rule.id]) summaries[rule.id] = [];

        try {
            const summary = rule.collectSummary(page);
            if (summary !== undefined && summary !== null) {
                summaries[rule.id].push(summary);
            }
        } catch (error) {
            console.error(
                `Rule "${rule.id}" (${rule.name}) threw during collectSummary and was skipped for ${page.url}: ${error.message}`
            );
        }
    }
}

async function runFinalRules(rules, summaries = {}, siteContext = {}) {
    const findings = [];

    for (const rule of rules) {
        if (typeof rule.runFinal !== "function") continue;

        console.log(`Running ${rule.name} (final pass)...`);

        try {
            const result = await rule.runFinal(summaries[rule.id] || [], siteContext);
            if (result && result.length) findings.push(...result);
        } catch (error) {
            console.error(
                `Rule "${rule.id}" (${rule.name}) threw during runFinal and was skipped: ${error.message}`
            );
        }
    }

    return findings;
}

module.exports = {
    runRules,
    runPerPageRules,
    collectSummaries,
    runFinalRules
};
