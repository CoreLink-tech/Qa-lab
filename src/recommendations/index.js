function generateRecommendations(findings) {

    const recommendations = [];

    findings.forEach(issue => {

        switch (issue.type) {

            case "Security Header":

                if (issue.details.includes("Content-Security-Policy")) {
                    recommendations.push({
                        priority: "High",
                        category: "Security",
                        issue: issue.details,
                        fix: "Add a Content-Security-Policy HTTP header to reduce XSS and code injection risks."
                    });
                }

                if (issue.details.includes("X-Frame-Options")) {
                    recommendations.push({
                        priority: "Medium",
                        category: "Security",
                        issue: issue.details,
                        fix: "Add the X-Frame-Options header to protect against clickjacking attacks."
                    });
                }

                if (issue.details.includes("X-Content-Type-Options")) {
                    recommendations.push({
                        priority: "Low",
                        category: "Security",
                        issue: issue.details,
                        fix: "Add the X-Content-Type-Options: nosniff header to stop MIME type sniffing."
                    });
                }

                break;

            case "SEO":

                recommendations.push({
                    priority: "Medium",
                    category: "SEO",
                    issue: issue.details,
                    fix: "Ensure every page contains one descriptive H1 heading."
                });

                break;

            case "Performance":

                recommendations.push({
                    priority: "High",
                    category: "Performance",
                    issue: issue.details,
                    fix: "Reduce server response time, compress assets, and enable caching."
                });

                break;

            case "Accessibility":

                recommendations.push({
                    priority: "Low",
                    category: "Accessibility",
                    issue: issue.details,
                    fix: "Add meaningful alt attributes to all images."
                });

                break;

            case "Form":

                recommendations.push({
                    priority: "Low",
                    category: "Forms",
                    issue: issue.details,
                    fix: "Add missing form attributes to improve accessibility and browser support."
                });

                break;
        }

    });

    return recommendations;
}

module.exports = {
    generateRecommendations
};
