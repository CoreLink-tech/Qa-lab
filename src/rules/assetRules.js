const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

const LARGE_ASSET_THRESHOLD_BYTES = 300 * 1024;

function findDuplicates(urls) {
    const counts = new Map();
    urls.forEach(url => counts.set(url, (counts.get(url) || 0) + 1));
    return [...counts.entries()].filter(([, count]) => count > 1);
}

module.exports = {
    id: "ASSETS",
    name: "Asset Rules",
    category: Category.ASSETS,
    description: "Checks for scripts/stylesheets loaded more than once on the same page, and (when --check-assets is used) missing, oversized, or duplicate-content assets site-wide.",
    enabled: true,

    // NOTE: this rule previously (AST001, "Possible Missing Asset") tried
    // to match raw <a href> links against scanned page URLs, which almost
    // never worked -- it only ever looked at anchor tags, never actual
    // <script src>/<link rel=stylesheet> references, and compared
    // unresolved relative hrefs against fully-resolved absolute URLs.
    // Retired now that the website model captures real script/stylesheet
    // resources (see normalizer.js), replaced with checks that are
    // actually reliable.
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

        // Site-wide asset checks: only run when the (opt-in, --check-assets)
        // fetch stage actually populated this. Rules themselves never do
        // network I/O -- this is precomputed data handed to them.
        if (websiteModel.assetChecks) {

            const byHash = new Map();

            for (const [url, result] of Object.entries(websiteModel.assetChecks)) {

                if (result.error || (result.status && result.status >= 400)) {
                    findings.push(createFinding({
                        id: "AST004",
                        title: "Missing or Unreachable Asset",
                        category: Category.ASSETS,
                        severity: Severity.MEDIUM,
                        page: url,
                        details: result.error
                            ? `Failed to fetch asset: ${result.error}`
                            : `Asset returned HTTP ${result.status}.`,
                        recommendation: "Fix or remove the reference to this asset so pages don't request a resource that doesn't load."
                    }));
                    continue;
                }

                if (result.tooLarge) {
                    findings.push(createFinding({
                        id: "AST005",
                        title: "Large Asset",
                        category: Category.ASSETS,
                        severity: Severity.MEDIUM,
                        page: url,
                        confidence: 80,
                        details: "Asset exceeds 5 MB (fetch was capped before completing, exact size unknown).",
                        recommendation: "Compress, resize, or lazy-load this asset. Assets this large meaningfully slow down page load."
                    }));
                } else if (result.sizeBytes > LARGE_ASSET_THRESHOLD_BYTES) {
                    findings.push(createFinding({
                        id: "AST005",
                        title: "Large Asset",
                        category: Category.ASSETS,
                        severity: Severity.LOW,
                        page: url,
                        details: `Asset is ${Math.round(result.sizeBytes / 1024)} KB.`,
                        recommendation: "Compress, resize, or lazy-load this asset to reduce page weight."
                    }));
                }

                if (result.hash) {
                    if (!byHash.has(result.hash)) byHash.set(result.hash, []);
                    byHash.get(result.hash).push(url);
                }
            }

            for (const [, urls] of byHash.entries()) {
                if (urls.length > 1) {
                    findings.push(createFinding({
                        id: "AST006",
                        title: "Duplicate Asset Content",
                        category: Category.ASSETS,
                        severity: Severity.LOW,
                        page: urls[0],
                        details: `Identical content is served from ${urls.length} different URLs: ${urls.join(", ")}`,
                        recommendation: "Serve this asset from a single canonical URL to avoid redundant downloads and cache fragmentation."
                    }));
                }
            }
        }

        return findings;
    }
};
