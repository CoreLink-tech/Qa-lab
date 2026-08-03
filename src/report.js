const fs = require("fs");
const path = require("path");
const generateHTMLReport = require("./htmlReport");

function generateReport(data) {

    const reportsDir = path.join(__dirname, "../reports");

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir);
    }


    // JSON report
    fs.writeFileSync(
        path.join(reportsDir, "report.json"),
        JSON.stringify(data, null, 2)
    );


    // HTML report
    const html = generateHTMLReport(data);

    fs.writeFileSync(
        path.join(reportsDir, "report.html"),
        html
    );


    console.log("\nReports generated:");
    console.log("reports/report.json");
    console.log("reports/report.html");

}


module.exports = generateReport;
