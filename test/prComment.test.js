const test = require("node:test");
const assert = require("node:assert/strict");
const { generatePRComment } = require("../src/prComment");

function fakeReportData(overrides = {}) {
    return {
        url: "https://example.com",
        score: { score: 85, grade: "B" },
        summary: { pagesScanned: 10, issuesFound: 4 },
        ...overrides
    };
}

test("includes score, grade, pages scanned, and issues found", () => {
    const comment = generatePRComment(fakeReportData());
    assert.match(comment, /85\/100 \(Grade B\)/);
    assert.match(comment, /Pages Scanned:\*\* 10/);
    assert.match(comment, /Issues Found:\*\* 4/);
});

test("shows no gate badge when no gate result is given", () => {
    const comment = generatePRComment(fakeReportData());
    assert.ok(!comment.includes("Quality gate"));
});

test("shows a PASSED badge for a passing gate", () => {
    const comment = generatePRComment(fakeReportData(), { passed: true, reasons: [] });
    assert.match(comment, /✅.*PASSED/);
});

test("shows a FAILED badge and lists reasons for a failing gate", () => {
    const comment = generatePRComment(fakeReportData(), {
        passed: false,
        reasons: ["2 finding(s) at or above \"high\" severity"]
    });
    assert.match(comment, /❌.*FAILED/);
    assert.match(comment, /2 finding\(s\) at or above/);
});

test("escapes scraped-adjacent content (the scanned URL) for safety", () => {
    const comment = generatePRComment(fakeReportData({ url: "https://example.com/<script>" }));
    assert.ok(!comment.includes("<script>"));
});
