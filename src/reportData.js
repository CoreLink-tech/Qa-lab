// Single source of truth for "what does a report look like", consumed by
// both the JSON writer and the HTML renderer, so they can't drift apart
// the way report.js and exporter.js previously did (two different shapes,
// both writing reports/report.json, silently overwriting each other).
function buildReportData(websiteModel) {
    const pages = websiteModel.pages.map(page => {
        // Exclude only the raw HTML source (large, not useful in a report).
        // Everything else the model captures is included by default --
        // this used to be an explicit field whitelist, which silently
        // dropped every new field added to the model (meta, scripts,
        // cookies, technologies, etc. were all missing from reports
        // until this was caught during Phase 3 testing).
        const { html, ...reportablePage } = page;
        return reportablePage;
    });

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

function filterReportDataByCategory(reportData, category) {
    const findings = (reportData.findings || []).filter(f => f.category === category);
    const recommendations = (reportData.recommendations || []).filter(r => r.category === category);

    return {
        ...reportData,
        findings,
        recommendations,
        summary: {
            ...reportData.summary,
            issuesFound: findings.length
        }
    };
}

module.exports = { buildReportData, filterReportDataByCategory };
