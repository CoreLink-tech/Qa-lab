const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "ASSETS",
    name: "Asset Rules",
    category: Category.ASSETS,
    description: "Checks for missing JavaScript and CSS assets.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            if (!page.links) continue;

            for (const link of page.links) {

                if (
                    !link.includes(".js") &&
                    !link.includes(".css")
                ) {
                    continue;
                }

                const assetExists = websiteModel.pages.some(
                    p => p.url === link
                );

                if (!assetExists) {

                    findings.push(
                        createFinding({
                            id: "AST001",
                            title: "Possible Missing Asset",
                            category: Category.ASSETS,
                            severity: Severity.MEDIUM,
                            page: page.url,
                            details: `Possible missing asset: ${link}`,
                            recommendation:
                                "Verify that the asset exists and is accessible. Check file paths, deployment configuration, and server routing.",
                            documentation:
                                "https://developer.mozilla.org/en-US/docs/Learn/Performance"
                        })
                    );

                }

            }

        }

        return findings;
    }
};
