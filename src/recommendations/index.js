const Severity = require("../constants/severity");

// Findings already carry a severity constant (Critical/High/Medium/Low/Info).
// Map that straight to a recommendation priority instead of re-deriving it.
const PRIORITY_BY_SEVERITY = {
    [Severity.CRITICAL]: "Critical",
    [Severity.HIGH]: "High",
    [Severity.MEDIUM]: "Medium",
    [Severity.LOW]: "Low",
    [Severity.INFO]: "Low"
};

function generateRecommendations(findings) {
    return findings
        // A finding with no recommendation text has nothing actionable to show.
        .filter(finding => finding.recommendation)
        .map(finding => ({
            priority: PRIORITY_BY_SEVERITY[finding.severity] || "Low",
            category: finding.category,
            issue: finding.title,
            fix: finding.recommendation
        }));
}

module.exports = {
    generateRecommendations
};
