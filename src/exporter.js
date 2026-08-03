const fs = require("fs");
const path = require("path");

function exportJSON(websiteModel) {

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

    const report = {
        url: websiteModel.url,
        timestamp: websiteModel.timestamp,
        score: websiteModel.score,
        summary: websiteModel.summary,
        findings: websiteModel.findings,
        recommendations: websiteModel.recommendations,
        pages
    };

    const reportDir = path.join(__dirname, "..", "reports");

    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, "report.json");

    fs.writeFileSync(
        reportPath,
        JSON.stringify(report, null, 4)
    );

    console.log(`\nJSON report saved to: ${reportPath}`);
}

module.exports = {
    exportJSON
};
