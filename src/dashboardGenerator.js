const { escapeHtml } = require("./htmlReport");

const CHART_WIDTH = 700;
const CHART_HEIGHT = 220;
const PADDING = { top: 20, right: 20, bottom: 50, left: 40 };
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

function scoreToY(score) {
    const clamped = Math.max(0, Math.min(100, score ?? 0));
    return PADDING.top + PLOT_HEIGHT - (clamped / 100) * PLOT_HEIGHT;
}

function indexToX(index, total) {
    if (total <= 1) return PADDING.left + PLOT_WIDTH / 2;
    return PADDING.left + (index / (total - 1)) * PLOT_WIDTH;
}

function formatDateLabel(timestamp) {
    if (!timestamp) return "-";
    return timestamp.slice(0, 10); // YYYY-MM-DD, no need to pull in a date library
}

// Hand-built SVG line chart -- no charting library, consistent with this
// project's zero-new-dependencies principle. Handles 1 point (single
// dot, no line) and many points (line + dots) the same way, without a
// separate code path for each.
function buildScoreChart(history) {
    if (history.length === 0) {
        return `<p class="empty">No scan history yet.</p>`;
    }

    const points = history.map((entry, i) => ({
        x: indexToX(i, history.length),
        y: scoreToY(entry.score),
        entry
    }));

    const gridlines = [0, 25, 50, 75, 100].map(value => {
        const y = scoreToY(value);
        return `
<line x1="${PADDING.left}" y1="${y.toFixed(1)}" x2="${CHART_WIDTH - PADDING.right}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>
<text x="${PADDING.left - 8}" y="${(y + 4).toFixed(1)}" font-size="11" fill="#6b7280" text-anchor="end">${value}</text>`;
    }).join("");

    const polyline = points.length > 1
        ? `<polyline points="${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="#2563eb" stroke-width="2"/>`
        : "";

    const dots = points.map(p => {
        const label = escapeHtml(`${formatDateLabel(p.entry.timestamp)}: ${p.entry.score ?? "-"}/100`);
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#2563eb"><title>${label}</title></circle>`;
    }).join("\n");

    // Label every point if there are few, otherwise thin them out so
    // labels don't overlap into unreadable mush on a long history.
    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    const dateLabels = points
        .filter((p, i) => i % labelStep === 0 || i === points.length - 1)
        .map(p => `<text x="${p.x.toFixed(1)}" y="${CHART_HEIGHT - PADDING.bottom + 20}" font-size="10" fill="#6b7280" text-anchor="middle">${escapeHtml(formatDateLabel(p.entry.timestamp))}</text>`)
        .join("\n");

    return `
<svg width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
${gridlines}
${polyline}
${dots}
${dateLabels}
</svg>`;
}

function buildHistoryTable(history) {
    if (history.length === 0) {
        return "<p>No scan history yet.</p>";
    }

    const rows = history.map(entry => `
<tr>
<td>${escapeHtml(entry.timestamp || "-")}</td>
<td>${escapeHtml(entry.score ?? "-")}</td>
<td>${escapeHtml(entry.grade || "-")}</td>
<td>${escapeHtml(entry.pagesScanned ?? "-")}</td>
<td>${escapeHtml(entry.issuesFound ?? "-")}</td>
</tr>`).join("");

    return `
<table>
<thead><tr><th>Timestamp</th><th>Score</th><th>Grade</th><th>Pages</th><th>Issues</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

function generateDashboard(history, url) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>QA-LAB Dashboard: ${escapeHtml(url)}</title>
<style>
body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
h1 { font-size: 20px; }
.empty { color: #6b7280; }
table { border-collapse: collapse; width: 100%; margin-top: 20px; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
th { color: #6b7280; font-weight: 600; }
svg { margin-top: 10px; }
</style>
</head>
<body>
<h1>QA-LAB Dashboard: ${escapeHtml(url)}</h1>
<p>${history.length} scan(s) recorded.</p>
${buildScoreChart(history)}
<h2>Scan History</h2>
${buildHistoryTable(history)}
</body>
</html>`;
}

module.exports = { generateDashboard, buildScoreChart, buildHistoryTable };
