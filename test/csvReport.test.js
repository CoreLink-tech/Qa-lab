const test = require("node:test");
const assert = require("node:assert/strict");
const { generateCSVReport, escapeCsvField } = require("../src/csvReport");

test("escapeCsvField leaves plain values untouched", () => {
    assert.equal(escapeCsvField("simple value"), "simple value");
});

test("escapeCsvField quotes and escapes a value containing a comma", () => {
    assert.equal(escapeCsvField("a, b"), '"a, b"');
});

test("escapeCsvField doubles internal quotes", () => {
    assert.equal(escapeCsvField('she said "hi"'), '"she said ""hi"""');
});

test("escapeCsvField quotes a value containing a newline", () => {
    assert.equal(escapeCsvField("line1\nline2"), '"line1\nline2"');
});

test("escapeCsvField handles null/undefined as empty string", () => {
    assert.equal(escapeCsvField(null), "");
    assert.equal(escapeCsvField(undefined), "");
});

test("generateCSVReport produces a header row plus one row per aggregated finding", () => {
    const reportData = {
        findings: [
            {
                id: "SEC001", title: "Missing CSP", category: "Security", severity: "Medium",
                affectedPageCount: 1, recommendation: "Add one.",
                examples: [{ page: "https://example.com/", details: "No CSP header." }]
            }
        ]
    };
    const csv = generateCSVReport(reportData);
    const lines = csv.trim().split("\r\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[0], "ID,Title,Category,Severity,Affected Pages,Example Pages,Recommendation");
    assert.equal(lines[1], "SEC001,Missing CSP,Security,Medium,1,https://example.com/,Add one.");
});

test("generateCSVReport correctly escapes a recommendation containing a comma and quotes", () => {
    const reportData = {
        findings: [
            {
                id: "X1", title: "Test", category: "SEO", severity: "Low",
                affectedPageCount: 1, recommendation: 'Fix "Home, Page" here',
                examples: [{ page: "https://example.com/", details: "detail" }]
            }
        ]
    };
    const csv = generateCSVReport(reportData);
    assert.ok(csv.includes('"Fix ""Home, Page"" here"'));
});

test("generateCSVReport joins multiple example pages into one field", () => {
    const reportData = {
        findings: [
            {
                id: "SEC001", title: "Missing CSP", category: "Security", severity: "Medium",
                affectedPageCount: 3, recommendation: "Add one.",
                examples: [
                    { page: "https://example.com/", details: "-" },
                    { page: "https://example.com/login", details: "-" }
                ]
            }
        ]
    };
    const csv = generateCSVReport(reportData);
    assert.ok(csv.includes("https://example.com/; https://example.com/login"));
});

test("generateCSVReport with no findings still produces just the header row", () => {
    const csv = generateCSVReport({ findings: [] });
    assert.equal(csv.trim(), "ID,Title,Category,Severity,Affected Pages,Example Pages,Recommendation");
});
