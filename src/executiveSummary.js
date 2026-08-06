const { escapeMarkdown } = require("./markdownReport");

const TOP_ISSUES_LIMIT = 10;

// A condensed, non-technical-audience report: overall score, the most
// urgent issues, and a category breakdown -- not the full finding-by-
// finding detail the technical report (JSON/HTML/MD/CSV) gives. Reuses
// the same escaping as the Markdown report since this has the same
// scraped-content risk.
function generateExecutiveSummary(reportData) {
    const { url, timestamp, score, summary, findings = [] } = reportData;

    const bySeverityOrder = ["Critical", "High"];
    const topIssues = findings
        .filter(f => bySeverityOrder.includes(f.severity))
        .sort((a, b) => bySeverityOrder.indexOf(a.severity) - bySeverityOrder.indexOf(b.severity))
        .slice(0, TOP_ISSUES_LIMIT);

    const lines = [];

    lines.push(`# Executive Summary: ${escapeMarkdown(url)}`);
    lines.push("");
    lines.push(`Scanned ${timestamp || "-"}. Overall score: **${score?.score ?? "-"}/100 (Grade ${score?.grade ?? "-"})**.`);
    lines.push("");
    lines.push(`${summary?.pagesScanned ?? 0} pages scanned, ${summary?.issuesFound ?? findings.length} issue(s) found.`);
    lines.push("");

    lines.push("## Top Priority Issues");
    lines.push("");

    if (topIssues.length > 0) {
        topIssues.forEach(finding => {
            lines.push(`- **[${finding.severity}] ${escapeMarkdown(finding.title)}** on ${escapeMarkdown(finding.page)}`);
        });
    } else {
        lines.push("No critical or high-severity issues found.");
    }
    lines.push("");

    const byCategory = {};
    findings.forEach(finding => {
        byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
    });

    lines.push("## Issues By Category");
    lines.push("");

    if (Object.keys(byCategory).length === 0) {
        lines.push("No issues found.");
    } else {
        Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
                lines.push(`- ${escapeMarkdown(category)}: ${count}`);
            });
    }

    return lines.join("\n");
}

module.exports = { generateExecutiveSummary };
