const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateScore } = require("../src/scoring");

function finding(id, severity) {
    return { id, severity, page: `https://example.com/${id}` };
}

test("no findings gives a perfect score and grade A", () => {
    const result = calculateScore([]);
    assert.equal(result.score, 100);
    assert.equal(result.grade, "A");
});

test("severity deductions for isolated, distinct issues: critical -20, high -10, medium -5, low -2", () => {
    const result = calculateScore([
        finding("A", "Critical"),
        finding("B", "High"),
        finding("C", "Medium"),
        finding("D", "Low")
    ]);
    // Each id is distinct (occurrenceCount 1 each) -- same math as a
    // single flat deduction per issue: 100 - 20 - 10 - 5 - 2 = 63
    assert.equal(result.score, 63);
});

test("many DISTINCT critical issues still floor the score at 0", () => {
    const manyDistinctCriticals = Array.from({ length: 10 }, (_, i) => finding(`CRIT${i}`, "Critical"));
    const result = calculateScore(manyDistinctCriticals);
    assert.equal(result.score, 0);
});

// This is the core regression this rewrite exists to fix: the same issue
// occurring on many pages is one problem, not N problems, and shouldn't
// cost N times as much with no cap. Previously this exact scenario (one
// issue, found on every page of a real-sized site) reliably floored the
// score at 0 regardless of how minor the issue actually was.
test("the SAME issue repeated across many pages costs far less than that many distinct issues would", () => {
    const widespreadSingleIssue = Array.from({ length: 48 }, () => finding("SEC005", "High"));
    const result = calculateScore(widespreadSingleIssue);
    // Capped: weight(10) * (1 + min(47,20)*0.1) = 10 * 3 = 30 deduction
    assert.equal(result.score, 70);
    assert.ok(result.score > 0, "a single widespread issue should not floor the score");
});

test("occurrence count beyond the breadth cap adds no further penalty", () => {
    const at20 = calculateScore(Array.from({ length: 21 }, () => finding("SEC005", "Medium")));
    const at500 = calculateScore(Array.from({ length: 500 }, () => finding("SEC005", "Medium")));
    assert.equal(at20.score, at500.score);
});

test("severity counts reflect unique issue TYPES, not raw occurrence count", () => {
    const result = calculateScore([
        finding("SEC005", "High"),
        finding("SEC005", "High"), // same issue, another page -- still 1 unique high
        finding("SEO001", "Low")
    ]);
    assert.equal(result.severity.high, 1);
    assert.equal(result.severity.low, 1);
    assert.equal(result.severity.critical, 0);
});

test("severity counts still increment per distinct id of the same severity", () => {
    const result = calculateScore([
        finding("SEC005", "High"),
        finding("SEC001", "High")
    ]);
    assert.equal(result.severity.high, 2);
});

test("grade boundaries, using distinct issues so breadth doesn't dampen the deduction", () => {
    // 4 distinct mediums = -20, lands score at 80 -> B
    const b = calculateScore(Array.from({ length: 4 }, (_, i) => finding(`M${i}`, "Medium")));
    assert.equal(b.score, 80);
    assert.equal(b.grade, "B");

    // 6 distinct mediums = -30, lands at 70 -> C
    const c = calculateScore(Array.from({ length: 6 }, (_, i) => finding(`M${i}`, "Medium")));
    assert.equal(c.score, 70);
    assert.equal(c.grade, "C");

    // 8 distinct mediums = -40, lands at 60 -> D
    const d = calculateScore(Array.from({ length: 8 }, (_, i) => finding(`M${i}`, "Medium")));
    assert.equal(d.score, 60);
    assert.equal(d.grade, "D");

    // 9 distinct mediums = -45, lands at 55 -> F
    const f = calculateScore(Array.from({ length: 9 }, (_, i) => finding(`M${i}`, "Medium")));
    assert.equal(f.score, 55);
    assert.equal(f.grade, "F");
});

test("score never goes negative even with many severe, widespread, distinct issues", () => {
    const disaster = [];
    for (let i = 0; i < 20; i++) {
        for (let p = 0; p < 50; p++) {
            disaster.push(finding(`CRIT${i}`, "Critical"));
        }
    }
    const result = calculateScore(disaster);
    assert.equal(result.score, 0);
});
