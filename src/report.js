const fs = require("fs");
const path = require("path");
const generateHTMLReport = require("./htmlReport");
const { buildReportData, filterReportDataByCategory } = require("./reportData");
const { generateCSVReport } = require("./csvReport");
const { generateMarkdownReport } = require("./markdownReport");
const { generateExecutiveSummary } = require("./executiveSummary");

const WRITERS = {
    json: (reportData) => ({
        filename: "report.json",
        content: JSON.stringify(reportData, null, 2)
    }),
    html: (reportData) => ({
        filename: "report.html",
        content: generateHTMLReport(reportData)
    }),
    csv: (reportData) => ({
        filename: "report.csv",
        content: generateCSVReport(reportData)
    }),
    md: (reportData) => ({
        filename: "report.md",
        content: generateMarkdownReport(reportData)
    }),
    executive: (reportData) => ({
        filename: "executive-summary.md",
        content: generateExecutiveSummary(reportData)
    })
};

// formats defaults to ["json", "html"] -- unchanged from every prior
// version of this tool, so a plain run with no format flags behaves
// exactly like it always has.
function generateReport(websiteModel, { formats = ["json", "html"], reportCategory = null } = {}) {

    const reportsDir = path.join(__dirname, "../reports");

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    let reportData = buildReportData(websiteModel);

    if (reportCategory) {
        reportData = filterReportDataByCategory(reportData, reportCategory);
    }

    console.log("\nReports generated:");

    for (const format of formats) {
        const writer = WRITERS[format];
        if (!writer) continue;

        const { filename, content } = writer(reportData);
        fs.writeFileSync(path.join(reportsDir, filename), content);
        console.log(`reports/${filename}`);
    }
}

module.exports = generateReport;
