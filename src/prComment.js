const { escapeMarkdown } = require("./markdownReport");

// Written as reports/pr-comment.md so a CI workflow just needs to `cat`
// the file into a PR comment step -- no scan-formatting logic embedded
// in YAML/github-script, consistent with how every other report format
// in this project is a tested Node module, not inline CI scripting.
function generatePRComment(reportData, gateResult = null) {
    const { url, score, summary } = reportData;

    const lines = [];

    lines.push("## QA-LAB Scan Result");
    lines.push("");

    if (gateResult) {
        lines.push(gateResult.passed ? "✅ **Quality gate: PASSED**" : "❌ **Quality gate: FAILED**");
        lines.push("");
    }

    lines.push(`**Score:** ${score?.score ?? "-"}/100 (Grade ${score?.grade ?? "-"})`);
    lines.push(`**Pages Scanned:** ${summary?.pagesScanned ?? 0}`);
    lines.push(`**Issues Found:** ${summary?.issuesFound ?? 0}`);
    lines.push("");

    if (gateResult && !gateResult.passed && gateResult.reasons.length > 0) {
        lines.push("**Reasons:**");
        gateResult.reasons.forEach(reason => lines.push(`- ${escapeMarkdown(reason)}`));
        lines.push("");
    }

    lines.push(`Scanned: ${escapeMarkdown(url)}`);

    return lines.join("\n");
}

module.exports = { generatePRComment };
