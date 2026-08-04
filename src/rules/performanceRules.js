onst createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "PERFORMANCE",
    name: "Performance Rules",
    category: Category.PERFORMANCE,
    description: "Checks page response times and identifies slow-loading pages.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            const responseTime = page.responseTime;

            if (typeof responseTime !== "number") {
                continue;
            }

            if (responseTime > 5000) {

                findings.push(
                    createFinding({
                        id: "PERF001",
                        title: "Very Slow Page Response",
                        category: Category.PERFORMANCE,
                        severity: Severity.HIGH,
                        page: page.url,
                        details: `Page response time is ${responseTime} ms.`,
                        recommendation:
                            "Reduce server response time to under 2 seconds by optimizing backend processing, database queries, caching, and infrastructure.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/Performance"
                    })
                );

            } else if (responseTime > 2000) {

                findings.push(
                    createFinding({
                        id: "PERF002",
                        title: "Slow Page Response",
                        category: Category.PERFORMANCE,
                        severity: Severity.MEDIUM,
                        page: page.url,
                        details: `Page response time is ${responseTime} ms.`,
                        recommendation:
                            "Optimize backend processing, caching, and database queries to improve response time.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/Performance"
                    })
                );

            }
        }

        return findings;
    }
};
