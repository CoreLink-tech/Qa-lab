// Finding data (title, details, page) can contain content scraped from
// the target site. Many Markdown renderers (including GitHub's) pass
// raw HTML through unchanged, so an unescaped "<script>" in a finding
// would render as a live tag, not text -- same category of risk as the
// HTML report, different rendering context. Neutralize angle brackets
// (blocks embedded HTML) and backticks (prevents breaking code spans).
function escapeMarkdown(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/`/g, "\\`")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/\|/g, "\\|")
        .replace(/\*/g, "\\*");
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
    findings.forEach(group => {
        if (!byCategory[group.category]) byCategory[group.category] = [];
        byCategory[group.category].push(group);
    });

    lines.push("## Findings");
    lines.push("");

    if (findings.length === 0) {
        lines.push("No issues found.");
        lines.push("");
    }

    // findings is already aggregated (one entry per unique issue TYPE --
    // see findingAggregator.js), so a header missing on 48 pages is one
    // bullet showing "48 pages affected", not 48 near-identical bullets.
    for (const [category, categoryGroups] of Object.entries(byCategory)) {
        lines.push(`### ${escapeMarkdown(category)} (${categoryGroups.length})`);
        lines.push("");

        categoryGroups.forEach(group => {
            const pageCount = group.affectedPageCount || 0;
            const pageLabel = pageCount === 1 ? "1 page" : `${pageCount} pages`;
            lines.push(`- **[${group.severity}] ${escapeMarkdown(group.title)}** — ${pageLabel} affected`);

            const exampleUrls = (group.examples || []).map(e => e.page).filter(Boolean);
            if (exampleUrls.length > 0) {
                const remaining = pageCount - exampleUrls.length;
                const suffix = remaining > 0 ? ` (+${remaining} more)` : "";
                lines.push(`  Example pages: ${escapeMarkdown(exampleUrls.join(", "))}${suffix}`);
            }
            if (group.recommendation) {
                lines.push(`  *Fix:* ${escapeMarkdown(group.recommendation)}`);
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
