function printSummary(websiteModel) {
    console.log("\n========== QA SUMMARY ==========\n");

    console.log(`Website       : ${websiteModel.url}`);
    console.log(`Score         : ${websiteModel.score.score}/100`);
    console.log(`Grade         : ${websiteModel.score.grade}`);
    console.log(`Pages Scanned : ${websiteModel.pages.length}`);
    console.log(`Issues Found  : ${websiteModel.findings.length}`);

    const counts = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
    };
	const categories = {};

	websiteModel.findings.forEach(issue => {

    if (counts[issue.severity] !== undefined) {
        counts[issue.severity]++;
    }

    categories[issue.type] = (categories[issue.type] || 0) + 1;

});

    console.log("\nSeverity");
    console.log(`Critical : ${counts.Critical}`);
    console.log(`High     : ${counts.High}`);
    console.log(`Medium   : ${counts.Medium}`);
    console.log(`Low      : ${counts.Low}`);
	console.log("\nCategories");

Object.entries(categories).forEach(([category, count]) => {
    console.log(`${category.padEnd(15)} ${count}`);
});

    console.log("\nReports");
    console.log("reports/report.html");
    console.log("reports/report.json");
}

module.exports = {
    printSummary,
    printIssues
};
function printIssues(websiteModel) {
    console.log("\n========== ISSUES ==========\n");

    if (websiteModel.findings.length === 0) {
        console.log("No issues found.");
        return;
    }

    websiteModel.findings.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.type}`);
        console.log(`   Severity : ${issue.severity}`);
        console.log(`   Page     : ${issue.page}`);
        console.log(`   Details  : ${issue.details}`);
        console.log("");
    });
}
