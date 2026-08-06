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
    const headers = ["ID", "Title", "Category", "Severity", "Page", "Details", "Recommendation"];

    const rows = (reportData.findings || []).map(finding => [
        finding.id,
        finding.title,
        finding.category,
        finding.severity,
        finding.page,
        finding.details,
        finding.recommendation
    ]);

    const lines = [headers, ...rows].map(row => row.map(escapeCsvField).join(","));

    return lines.join("\r\n") + "\r\n";
}

module.exports = { generateCSVReport, escapeCsvField };
