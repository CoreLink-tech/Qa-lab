const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "LINKS",
    name: "Link Rules",
    category: Category.LINKS,
    description: "Checks for broken links and inaccessible pages.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            if (typeof page.status !== "number") {
                continue;
            }

            if (page.status >= 400) {

                findings.push(
                    createFinding({
                        id: "LINK001",
                        title: "Broken Link Detected",
                        category: Category.LINKS,
                        severity: Severity.HIGH,
                        page: page.url,
                        details: `Page returned HTTP ${page.status}.`,
                        recommendation:
                            "Verify that the URL exists, correct broken references, or configure proper redirects.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status"
                    })
                );

            }

        }

        return findings;
    }
};
