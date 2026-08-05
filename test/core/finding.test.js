const test = require("node:test");
const assert = require("node:assert/strict");
const createFinding = require("../../src/core/finding");

test("creates a finding with required fields and sensible defaults", () => {
    const finding = createFinding({ id: "X1", title: "Test", category: "SEO" });
    assert.equal(finding.id, "X1");
    assert.equal(finding.title, "Test");
    assert.equal(finding.category, "SEO");
    assert.equal(finding.severity, "Info");
    assert.equal(finding.confidence, 100);
    assert.equal(finding.page, "");
    assert.equal(finding.details, "");
    assert.ok(finding.timestamp);
});

test("throws when id is missing", () => {
    assert.throws(() => createFinding({ title: "Test", category: "SEO" }), /id/i);
});

test("throws when title is missing", () => {
    assert.throws(() => createFinding({ id: "X1", category: "SEO" }), /title/i);
});

test("throws when category is missing", () => {
    assert.throws(() => createFinding({ id: "X1", title: "Test" }), /category/i);
});

test("preserves explicitly passed optional fields", () => {
    const finding = createFinding({
        id: "X1",
        title: "Test",
        category: "SEO",
        severity: "High",
        confidence: 80,
        page: "https://example.com/",
        details: "details here",
        recommendation: "fix it"
    });
    assert.equal(finding.severity, "High");
    assert.equal(finding.confidence, 80);
    assert.equal(finding.recommendation, "fix it");
});
