const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "SEO",
    name: "SEO Rules",
    category: Category.SEO,
    description: "Checks heading structure.",
    enabled: true,

    run(websiteModel) {

        const issues = [];

        websiteModel.pages.forEach(page => {

            const h1Count = page.headings?.h1 || 0;

            if (h1Count === 0) {
                issues.push(
                    createFinding({
                        id: "SEO001",
                        title: "Missing H1 Heading",
                        category: Category.SEO,
                        severity: Severity.LOW,
                        page: page.url,
                        details: "Page does not contain an H1 heading.",
                        recommendation: "Add one descriptive H1 heading to the page."
                    })
                );
            }

            if (h1Count > 1) {
                issues.push(
                    createFinding({
                        id: "SEO002",
                        title: "Multiple H1 Headings",
                        category: Category.SEO,
                        severity: Severity.MEDIUM,
                        page: page.url,
                        details: `Page contains ${h1Count} H1 headings.`,
                        recommendation: "Use only one H1 heading per page."
                    })
                );
            }

        });

        return issues;
    }
};
