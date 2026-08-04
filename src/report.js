const fs = require("fs");
const path = require("path");
const generateHTMLReport = require("./htmlReport");
const { buildReportData } = require("./reportData");

function generateReport(websiteModel) {

    const reportsDir = path.join(__dirname, "../reports");

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportData = buildReportData(websiteModel);

    fs.writeFileSync(
        path.join(reportsDir, "report.json"),
        JSON.stringify(reportData, null, 2)
    );

    const html = generateHTMLReport(reportData);

    fs.writeFileSync(
        path.join(reportsDir, "report.html"),
        html
    );

    console.log("\nReports generated:");
    console.log("reports/report.json");
    console.log("reports/report.html");
}

module.exports = generateReport;
