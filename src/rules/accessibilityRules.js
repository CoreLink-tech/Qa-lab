const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "ACCESSIBILITY",
    name: "Accessibility Rules",
    category: Category.ACCESSIBILITY,
    description: "Checks for common accessibility issues such as missing image alt attributes.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            const missingAlt = page.images?.missingAlt || 0;

            if (missingAlt > 0) {
                findings.push(
                    createFinding({
                        id: "ACC001",
                        title: "Images Missing Alt Attributes",
                        category: Category.ACCESSIBILITY,
                        severity: Severity.LOW,
                        page: page.url,
                        details: `${missingAlt} image(s) do not have alt attributes.`,
                        recommendation:
                            "Provide meaningful alt text for every informative image. Use an empty alt attribute (alt=\"\") only for decorative images.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt"
                    })
                );
            }
        }

        return findings;
    }
};
