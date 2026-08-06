const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const generateReport = require("../src/report");

const reportsDir = path.join(__dirname, "../reports");

function cleanReportsDir() {
    if (fs.existsSync(reportsDir)) {
        fs.rmSync(reportsDir, { recursive: true, force: true });
    }
}

test.beforeEach(cleanReportsDir);
test.after(cleanReportsDir);

function fakeModel() {
    return {
        url: "https://example.com",
        schemaVersion: "1.0",
        timestamp: "2026-01-01T00:00:00.000Z",
        score: { score: 90, grade: "A", severity: { critical: 0, high: 0, medium: 1, low: 0 } },
        summary: { pagesScanned: 1, issuesFound: 1 },
        pages: [{ url: "https://example.com/", status: 200 }],
        findings: [{ id: "SEO001", title: "Missing H1", category: "SEO", severity: "Medium", page: "https://example.com/", details: "x", recommendation: "y" }],
        recommendations: [{ priority: "Medium", category: "SEO", issue: "Missing H1", fix: "y" }]
    };
}

test("default (no formats specified) writes exactly json and html, matching prior behavior", () => {
    generateReport(fakeModel());
    assert.ok(fs.existsSync(path.join(reportsDir, "report.json")));
    assert.ok(fs.existsSync(path.join(reportsDir, "report.html")));
    assert.ok(!fs.existsSync(path.join(reportsDir, "report.csv")));
    assert.ok(!fs.existsSync(path.join(reportsDir, "report.md")));
});

test("formats:['csv'] writes only the CSV file", () => {
    generateReport(fakeModel(), { formats: ["csv"] });
    assert.ok(fs.existsSync(path.join(reportsDir, "report.csv")));
    assert.ok(!fs.existsSync(path.join(reportsDir, "report.json")));
    assert.ok(!fs.existsSync(path.join(reportsDir, "report.html")));
});

test("can write all five formats at once", () => {
    generateReport(fakeModel(), { formats: ["json", "html", "csv", "md", "executive"] });
    assert.ok(fs.existsSync(path.join(reportsDir, "report.json")));
    assert.ok(fs.existsSync(path.join(reportsDir, "report.html")));
    assert.ok(fs.existsSync(path.join(reportsDir, "report.csv")));
    assert.ok(fs.existsSync(path.join(reportsDir, "report.md")));
    assert.ok(fs.existsSync(path.join(reportsDir, "executive-summary.md")));
});

test("reportCategory filters findings before they reach any format", () => {
    const model = fakeModel();
    model.findings.push({ id: "SEC001", title: "Missing CSP", category: "Security", severity: "Medium", page: "https://example.com/", details: "x", recommendation: "y" });
    model.recommendations.push({ priority: "Medium", category: "Security", issue: "Missing CSP", fix: "y" });

    generateReport(model, { formats: ["json"], reportCategory: "Security" });

    const written = JSON.parse(fs.readFileSync(path.join(reportsDir, "report.json"), "utf8"));
    assert.equal(written.findings.length, 1);
    assert.equal(written.findings[0].category, "Security");
});

test("an unrecognized format string is silently ignored rather than crashing the whole report", () => {
    assert.doesNotThrow(() => generateReport(fakeModel(), { formats: ["json", "not-a-real-format"] }));
    assert.ok(fs.existsSync(path.join(reportsDir, "report.json")));
});

test("generateReport returns the reportData it built, so callers can reuse it", () => {
    const returned = generateReport(fakeModel(), { formats: ["json"] });
    assert.equal(returned.url, "https://example.com");
    assert.equal(returned.findings.length, 1);
});
