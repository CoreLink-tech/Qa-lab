// RFC 4180-style CSV: fields containing a comma, quote, or newline get
// wrapped in quotes, with internal quotes doubled. Uses CRLF line
// endings per spec.
function escapeCsvField(value) {
    const str = String(value ?? "");

    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}

function generateCSVReport(reportData) {
    const headers = ["ID", "Title", "Category", "Severity", "Affected Pages", "Example Pages", "Recommendation"];

    // reportData.findings is already aggregated (one row per unique issue
    // TYPE -- see findingAggregator.js), so a header missing on 48 pages
    // is one CSV row with "Affected Pages: 48", not 48 identical rows.
    const rows = (reportData.findings || []).map(group => [
        group.id,
        group.title,
        group.category,
        group.severity,
        group.affectedPageCount,
        (group.examples || []).map(e => e.page).filter(Boolean).join("; "),
        group.recommendation
    ]);

    const lines = [headers, ...rows].map(row => row.map(escapeCsvField).join(","));

    return lines.join("\r\n") + "\r\n";
}

module.exports = { generateCSVReport, escapeCsvField };
