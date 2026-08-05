const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateScore } = require("../src/scoring");

function finding(severity) {
    return { severity };
}

test("no findings gives a perfect score and grade A", () => {
    const result = calculateScore([]);
    assert.equal(result.score, 100);
    assert.equal(result.grade, "A");
});

test("severity deductions: critical -20, high -10, medium -5, low -2", () => {
    const result = calculateScore([
        finding("Critical"),
        finding("High"),
        finding("Medium"),
        finding("Low")
    ]);
    // 100 - 20 - 10 - 5 - 2 = 63
    assert.equal(result.score, 63);
});

test("score floors at 0, never goes negative", () => {
    const manyCriticals = Array.from({ length: 10 }, () => finding("Critical"));
    const result = calculateScore(manyCriticals);
    assert.equal(result.score, 0);
});

test("severity counts are tallied correctly", () => {
    const result = calculateScore([finding("High"), finding("High"), finding("Low")]);
    assert.equal(result.severity.high, 2);
    assert.equal(result.severity.low, 1);
    assert.equal(result.severity.critical, 0);
});

test("grade boundaries: 90=A, 80=B, 70=C, 60=D, below 60=F", () => {
    // 4 mediums = -20, lands score at 80 -> B
    const b = calculateScore(Array.from({ length: 4 }, () => finding("Medium")));
    assert.equal(b.score, 80);
    assert.equal(b.grade, "B");

    // 6 mediums = -30, lands at 70 -> C
    const c = calculateScore(Array.from({ length: 6 }, () => finding("Medium")));
    assert.equal(c.score, 70);
    assert.equal(c.grade, "C");

    // 8 mediums = -40, lands at 60 -> D
    const d = calculateScore(Array.from({ length: 8 }, () => finding("Medium")));
    assert.equal(d.score, 60);
    assert.equal(d.grade, "D");

    // 9 mediums = -45, lands at 55 -> F
    const f = calculateScore(Array.from({ length: 9 }, () => finding("Medium")));
    assert.equal(f.score, 55);
    assert.equal(f.grade, "F");
});
