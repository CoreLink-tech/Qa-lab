const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

function findDuplicates(urls) {
    const counts = new Map();
    urls.forEach(url => counts.set(url, (counts.get(url) || 0) + 1));
    return [...counts.entries()].filter(([, count]) => count > 1);
}

module.exports = {
    id: "ASSETS",
    name: "Asset Rules",
    category: Category.ASSETS,
    description: "Checks for scripts/stylesheets loaded more than once on the same page.",
    enabled: true,

    // NOTE: this rule previously (AST001, "Possible Missing Asset") tried
    // to match raw <a href> links against scanned page URLs, which almost
    // never worked -- it only ever looked at anchor tags, never actual
    // <script src>/<link rel=stylesheet> references, and compared
    // unresolved relative hrefs against fully-resolved absolute URLs.
    // Retired now that the website model captures real script/stylesheet
    // resources (see normalizer.js), replaced with checks that are
    // actually reliable. "Missing"/"large" asset checks need to fetch
    // each resource, which is a separate, deliberate decision (adds
    // real network load) -- not done here.
    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            const scriptSrcs = (page.scripts || [])
                .map(s => s.src)
                .filter(Boolean);

            const duplicateScripts = findDuplicates(scriptSrcs);

            if (duplicateScripts.length > 0) {
                findings.push(createFinding({
                    id: "AST002",
                    title: "Script Loaded Multiple Times",
                    category: Category.ASSETS,
                    severity: Severity.LOW,
                    page: page.url,
                    details: `${duplicateScripts.length} script URL(s) are referenced more than once: ${duplicateScripts.map(([url]) => url).join(", ")}`,
                    recommendation: "Include each script only once per page to avoid redundant downloads and potential re-initialization bugs."
                }));
            }

            const stylesheetHrefs = (page.stylesheets || [])
                .map(s => s.href)
                .filter(Boolean);

            const duplicateStylesheets = findDuplicates(stylesheetHrefs);

            if (duplicateStylesheets.length > 0) {
                findings.push(createFinding({
                    id: "AST003",
                    title: "Stylesheet Loaded Multiple Times",
                    category: Category.ASSETS,
                    severity: Severity.LOW,
                    page: page.url,
                    details: `${duplicateStylesheets.length} stylesheet URL(s) are referenced more than once: ${duplicateStylesheets.map(([url]) => url).join(", ")}`,
                    recommendation: "Include each stylesheet only once per page to avoid redundant downloads and CSS ordering issues."
                }));
            }
        }

        return findings;
    }
};
