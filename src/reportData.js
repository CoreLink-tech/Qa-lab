// Single source of truth for "what does a report look like", consumed by
// both the JSON writer and the HTML renderer, so they can't drift apart
// the way report.js and exporter.js previously did (two different shapes,
// both writing reports/report.json, silently overwriting each other).
function buildReportData(websiteModel) {
    const pages = websiteModel.pages.map(page => ({
        url: page.url,
        status: page.status,
        responseTime: page.responseTime,
        title: page.title,
        headings: page.headings,
        images: page.images,
        forms: page.forms,
        links: page.links,
        headers: page.headers
    }));

    return {
        schemaVersion: websiteModel.schemaVersion,
        url: websiteModel.url,
        timestamp: websiteModel.timestamp,
        score: websiteModel.score,
        summary: websiteModel.summary,
        findings: websiteModel.findings,
        recommendations: websiteModel.recommendations,
        pages
    };
}

module.exports = { buildReportData };
