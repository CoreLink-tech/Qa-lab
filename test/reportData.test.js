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

test("filterReportDataByCategory keeps only matching findings and recommendations", () => {
    const { filterReportDataByCategory } = require("../src/reportData");
    const reportData = {
        summary: { issuesFound: 3 },
        findings: [
            { id: "A", category: "Security" },
            { id: "B", category: "SEO" },
            { id: "C", category: "Security" }
        ],
        recommendations: [
            { issue: "A", category: "Security" },
            { issue: "B", category: "SEO" }
        ]
    };
    const filtered = filterReportDataByCategory(reportData, "Security");
    assert.equal(filtered.findings.length, 2);
    assert.ok(filtered.findings.every(f => f.category === "Security"));
    assert.equal(filtered.recommendations.length, 1);
    assert.equal(filtered.summary.issuesFound, 2);
});

test("filterReportDataByCategory returns empty results for a category with no matches", () => {
    const { filterReportDataByCategory } = require("../src/reportData");
    const reportData = { summary: {}, findings: [{ id: "A", category: "SEO" }], recommendations: [] };
    const filtered = filterReportDataByCategory(reportData, "Security");
    assert.equal(filtered.findings.length, 0);
    assert.equal(filtered.summary.issuesFound, 0);
});
