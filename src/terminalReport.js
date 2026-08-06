function printSummary(websiteModel, formats = []) {
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
        categories[issue.category] = (categories[issue.category] || 0) + 1;
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

    // Reflects whichever formats were actually written this run, instead
    // of always claiming report.json/report.html regardless of what
    // --csv/--md/etc. actually produced.
    if (formats.length > 0) {
        console.log("\nReports");
        const filenames = {
            json: "report.json", html: "report.html", csv: "report.csv",
            md: "report.md", executive: "executive-summary.md"
        };
        formats.forEach(format => {
            if (filenames[format]) console.log(`reports/${filenames[format]}`);
        });
    }
}

function printIssues(websiteModel) {
    console.log("\n========== ISSUES ==========\n");

    if (websiteModel.findings.length === 0) {
        console.log("No issues found.");
        return;
    }

    websiteModel.findings.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.title}`);
        console.log(`   Severity : ${issue.severity}`);
        console.log(`   Page     : ${issue.page}`);
        console.log(`   Details  : ${issue.details}`);
        console.log("");
    });
}

function printHistory(history, url) {
    console.log(`\n========== SCAN HISTORY: ${url} ==========\n`);

    if (history.length === 0) {
        console.log("No prior scans found for this site.");
        return;
    }

    console.log("Timestamp                 Score  Grade  Pages  Issues");
    history.forEach(entry => {
        const ts = (entry.timestamp || "-").padEnd(26);
        const score = String(entry.score ?? "-").padEnd(7);
        const grade = String(entry.grade ?? "-").padEnd(7);
        const pages = String(entry.pagesScanned ?? "-").padEnd(7);
        console.log(`${ts} ${score}${grade}${pages}${entry.issuesFound ?? "-"}`);
    });
}

function printComparison(comparison) {
    console.log("\n========== COMPARED TO PREVIOUS SCAN ==========\n");

    if (comparison.previousTimestamp === null) {
        console.log("No previous scan found for this site -- nothing to compare against.");
        return;
    }

    console.log(`Previous scan : ${comparison.previousTimestamp}`);
    console.log(`Previous score: ${comparison.previousScore}`);
    console.log(`Current score : ${comparison.currentScore}`);

    const delta = comparison.scoreDelta;
    const deltaStr = delta === null ? "-" : (delta > 0 ? `+${delta}` : `${delta}`);
    console.log(`Score change  : ${deltaStr}`);

    console.log(`\nNew Issues (${comparison.newIssues.length}):`);
    if (comparison.newIssues.length === 0) {
        console.log("  None");
    } else {
        comparison.newIssues.forEach(issue => {
            console.log(`  [${issue.severity}] ${issue.title} - ${issue.page}`);
        });
    }

    console.log(`\nResolved Issues (${comparison.resolvedIssues.length}):`);
    if (comparison.resolvedIssues.length === 0) {
        console.log("  None");
    } else {
        comparison.resolvedIssues.forEach(issue => {
            console.log(`  [${issue.severity}] ${issue.title} - ${issue.page}`);
        });
    }
}

module.exports = {
    printSummary,
    printIssues,
    printHistory,
    printComparison
};
