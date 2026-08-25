const fs = require("fs");

// Streams the JSON report directly to disk as pages are processed, instead
// of building one big in-memory array first -- the dominant remaining
// source of peak memory on large crawls (thousands of pages), even after
// each page's raw HTML is stripped during normalization (see
// normalizer.js). Only score/summary/findings/recommendations need to be
// held in memory for the whole run; per-page data is written and then
// forgotten as soon as each page is processed.
//
// Two deliberate, documented differences from the old batch-built report:
//   1. Field order: schemaVersion/url/timestamp/pages come first (pages
//      are streamed as they're processed), then score/summary/findings/
//      recommendations at the end (only knowable once every page has been
//      processed). Content is identical either way -- this only affects
//      key order in the JSON, which no well-behaved JSON consumer should
//      depend on.
//   2. Formatting: output is compact (no indentation), not pretty-printed
//      with 2-space indent like the old report.json. Pretty-printing while
//      streaming would mean manually tracking indentation depth for no
//      real benefit -- a report covering thousands of pages isn't
//      practical to read by hand either way, pretty-printed or not.
function createJsonReportWriter(filePath, { schemaVersion, url, timestamp }) {
    const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
    let pageCount = 0;
    let finalized = false;

    stream.write(
        `{"schemaVersion":${JSON.stringify(schemaVersion)},` +
        `"url":${JSON.stringify(url)},` +
        `"timestamp":${JSON.stringify(timestamp)},` +
        `"pages":[`
    );

    function writePage(page) {
        if (finalized) {
            throw new Error("createJsonReportWriter: writePage() called after finalize().");
        }

        // Exclude only the raw HTML source -- everything else the model
        // captures is included by default, deliberately, so new fields
        // don't silently vanish from reports (this mirrors buildReportData
        // in reportData.js; see the comment there for why that matters).
        const { html, ...reportablePage } = page;

        const prefix = pageCount === 0 ? "" : ",";
        stream.write(prefix + JSON.stringify(reportablePage));
        pageCount++;
    }

    function finalize({ score, summary, findings, recommendations }) {
        finalized = true;

        stream.write(
            `],"score":${JSON.stringify(score)},` +
            `"summary":${JSON.stringify(summary)},` +
            `"findings":${JSON.stringify(findings)},` +
            `"recommendations":${JSON.stringify(recommendations)}}`
        );

        return new Promise((resolve, reject) => {
            stream.end(error => error ? reject(error) : resolve());
        });
    }

    return {
        writePage,
        finalize,
        get pageCount() {
            return pageCount;
        }
    };
}

module.exports = { createJsonReportWriter };
