const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReportData } = require("../src/reportData");

test("excludes raw html from page output", () => {
    const model = {
        url: "https://example.com",
        pages: [{ url: "https://example.com/", html: "<html>huge blob</html>", status: 200 }]
    };
    const report = buildReportData(model);
    assert.equal(report.pages[0].html, undefined);
    assert.equal(report.pages[0].status, 200);
});

test("passes through every other page field without needing an explicit whitelist entry", () => {
    // Regression test for the bug found during Phase 3 testing: an
    // explicit field whitelist here silently dropped meta/scripts/
    // cookies/technologies from every report. Any new field added to
    // a page object should show up in report data automatically.
    const model = {
        url: "https://example.com",
        pages: [{
            url: "https://example.com/",
            html: "<html></html>",
            someBrandNewFieldNobodyKnowsAboutYet: "should still appear"
        }]
    };
    const report = buildReportData(model);
    assert.equal(report.pages[0].someBrandNewFieldNobodyKnowsAboutYet, "should still appear");
});

test("includes top-level score, summary, findings, and recommendations", () => {
    const model = {
        url: "https://example.com",
        schemaVersion: "1.0",
        timestamp: "2026-01-01T00:00:00.000Z",
        score: { score: 90, grade: "A" },
        summary: { pagesScanned: 1 },
        findings: [{ id: "X" }],
        recommendations: [{ issue: "X" }],
        pages: []
    };
    const report = buildReportData(model);
    assert.equal(report.score.score, 90);
    assert.equal(report.summary.pagesScanned, 1);
    assert.equal(report.findings.length, 1);
    assert.equal(report.recommendations.length, 1);
});
