onst createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "FUNCTIONALITY",
    name: "Functionality Rules",
    category: Category.FUNCTIONALITY,
    description: "Checks for pages that fail to load successfully.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            if (typeof page.status !== "number") {
                continue;
            }

            if (page.status !== 200) {

                findings.push(
                    createFinding({
                        id: "FUNC001",
                        title: "Page Failed to Load",
                        category: Category.FUNCTIONALITY,
                        severity: Severity.HIGH,
                        page: page.url,
                        details: `Page returned HTTP status ${page.status}.`,
                        recommendation:
                            "Investigate the page, verify routing and server configuration, and ensure the page responds with HTTP 200 when expected.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status"
                    })
                );

            }

        }

        return findings;
    }
};
