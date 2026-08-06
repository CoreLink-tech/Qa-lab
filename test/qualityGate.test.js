const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateQualityGate, isValidSeverity } = require("../src/qualityGate");

function score(overrides = {}) {
    return {
        score: 100,
        grade: "A",
        severity: { critical: 0, high: 0, medium: 0, low: 0 },
        ...overrides
    };
}

test("passes with no options given (gate not requested)", () => {
    const result = evaluateQualityGate(score(), {});
    assert.equal(result.passed, true);
    assert.deepEqual(result.reasons, []);
});

test("passes when no findings meet the fail-on severity threshold", () => {
    const result = evaluateQualityGate(
        score({ severity: { critical: 0, high: 0, medium: 3, low: 5 } }),
        { failOnSeverity: "high" }
    );
    assert.equal(result.passed, true);
});

test("fails when a finding meets the fail-on severity threshold exactly", () => {
    const result = evaluateQualityGate(
        score({ severity: { critical: 0, high: 1, medium: 0, low: 0 } }),
        { failOnSeverity: "high" }
    );
    assert.equal(result.passed, false);
    assert.match(result.reasons[0], /1 finding\(s\) at or above "high"/);
});

test("fail-on is inclusive of higher severities too (critical counts toward a 'high' gate)", () => {
    const result = evaluateQualityGate(
        score({ severity: { critical: 2, high: 0, medium: 0, low: 0 } }),
        { failOnSeverity: "high" }
    );
    assert.equal(result.passed, false);
    assert.match(result.reasons[0], /2 finding\(s\)/);
});

test("fail-on is case-insensitive", () => {
    const result = evaluateQualityGate(
        score({ severity: { critical: 1, high: 0, medium: 0, low: 0 } }),
        { failOnSeverity: "CRITICAL" }
    );
    assert.equal(result.passed, false);
});

test("min-score passes when score is at or above the threshold", () => {
    const result = evaluateQualityGate(score({ score: 70 }), { minScore: 70 });
    assert.equal(result.passed, true);
});

test("min-score fails when score is below the threshold", () => {
    const result = evaluateQualityGate(score({ score: 65 }), { minScore: 70 });
    assert.equal(result.passed, false);
    assert.match(result.reasons[0], /score 65 is below minimum 70/);
});

test("fail-on and min-score are composable: either failing condition fails the gate", () => {
    const result = evaluateQualityGate(
        score({ score: 65, severity: { critical: 1, high: 0, medium: 0, low: 0 } }),
        { failOnSeverity: "critical", minScore: 70 }
    );
    assert.equal(result.passed, false);
    assert.equal(result.reasons.length, 2);
});

test("isValidSeverity accepts known levels and rejects unknown ones", () => {
    assert.equal(isValidSeverity("critical"), true);
    assert.equal(isValidSeverity("High"), true);
    assert.equal(isValidSeverity("catastrophic"), false);
    assert.equal(isValidSeverity(""), false);
});
