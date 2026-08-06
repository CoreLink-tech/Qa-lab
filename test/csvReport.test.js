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

test("generateCSVReport produces a header row plus one row per finding", () => {
    const reportData = {
        findings: [
            { id: "SEC001", title: "Missing CSP", category: "Security", severity: "Medium", page: "https://example.com/", details: "No CSP header.", recommendation: "Add one." }
        ]
    };
    const csv = generateCSVReport(reportData);
    const lines = csv.trim().split("\r\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[0], "ID,Title,Category,Severity,Page,Details,Recommendation");
    assert.equal(lines[1], "SEC001,Missing CSP,Security,Medium,https://example.com/,No CSP header.,Add one.");
});

test("generateCSVReport correctly escapes a finding whose details contain a comma and quotes", () => {
    const reportData = {
        findings: [
            { id: "X1", title: "Test", category: "SEO", severity: "Low", page: "https://example.com/", details: 'Title is "Home, Page" here', recommendation: "Fix it" }
        ]
    };
    const csv = generateCSVReport(reportData);
    assert.ok(csv.includes('"Title is ""Home, Page"" here"'));
});

test("generateCSVReport with no findings still produces just the header row", () => {
    const csv = generateCSVReport({ findings: [] });
    assert.equal(csv.trim(), "ID,Title,Category,Severity,Page,Details,Recommendation");
});
