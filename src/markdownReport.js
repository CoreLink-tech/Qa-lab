// Finding data (title, details, page) can contain content scraped from
// the target site. Many Markdown renderers (including GitHub's) pass
// raw HTML through unchanged, so an unescaped "<script>" in a finding
// would render as a live tag, not text -- same category of risk as the
// HTML report, different rendering context. Neutralize angle brackets
// (blocks embedded HTML) and backticks (prevents breaking code spans).
function escapeMarkdown(value) {
    return String(value ?? "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/`/g, "\\`");
}

function generateMarkdownReport(reportData) {
    const { url, timestamp, score, summary, findings = [], recommendations = [] } = reportData;

    const lines = [];

    lines.push(`# QA-LAB Report: ${escapeMarkdown(url)}`);
    lines.push("");
    lines.push(`**Scanned:** ${timestamp || "-"}`);
    lines.push(`**Score:** ${score?.score ?? "-"} / 100 (Grade ${score?.grade ?? "-"})`);
    lines.push(`**Pages Scanned:** ${summary?.pagesScanned ?? 0}`);
    lines.push(`**Issues Found:** ${summary?.issuesFound ?? findings.length}`);
    lines.push("");

    const severity = score?.severity || {};
    lines.push("## Severity Breakdown");
    lines.push("");
    lines.push("| Severity | Count |");
    lines.push("|---|---|");
    lines.push(`| Critical | ${severity.critical || 0} |`);
    lines.push(`| High | ${severity.high || 0} |`);
    lines.push(`| Medium | ${severity.medium || 0} |`);
    lines.push(`| Low | ${severity.low || 0} |`);
    lines.push("");

    const byCategory = {};
    findings.forEach(finding => {
        if (!byCategory[finding.category]) byCategory[finding.category] = [];
        byCategory[finding.category].push(finding);
    });

    lines.push("## Findings");
    lines.push("");

    if (findings.length === 0) {
        lines.push("No issues found.");
        lines.push("");
    }

    for (const [category, categoryFindings] of Object.entries(byCategory)) {
        lines.push(`### ${escapeMarkdown(category)} (${categoryFindings.length})`);
        lines.push("");

        categoryFindings.forEach(finding => {
            lines.push(`- **[${finding.severity}] ${escapeMarkdown(finding.title)}** — ${escapeMarkdown(finding.page)}`);
            lines.push(`  ${escapeMarkdown(finding.details)}`);
            if (finding.recommendation) {
                lines.push(`  *Fix:* ${escapeMarkdown(finding.recommendation)}`);
            }
            lines.push("");
        });
    }

    if (recommendations.length > 0) {
        lines.push("## Recommendations");
        lines.push("");
        recommendations.forEach(rec => {
            lines.push(`- **[${rec.priority}]** ${escapeMarkdown(rec.issue)}: ${escapeMarkdown(rec.fix)}`);
        });
        lines.push("");
    }

    return lines.join("\n");
}

module.exports = { generateMarkdownReport, escapeMarkdown };
