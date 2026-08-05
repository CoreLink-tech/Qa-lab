const test = require("node:test");
const assert = require("node:assert/strict");
const { generateRecommendations } = require("../src/recommendations");
const Severity = require("../src/constants/severity");
const Category = require("../src/constants/categories");

function finding(overrides = {}) {
    return {
        id: "X1",
        title: "Test Issue",
        category: Category.SEO,
        severity: Severity.LOW,
        recommendation: "Fix the thing.",
        ...overrides
    };
}

test("maps a finding with a recommendation into a recommendation entry", () => {
    const recs = generateRecommendations([finding()]);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].issue, "Test Issue");
    assert.equal(recs[0].fix, "Fix the thing.");
    assert.equal(recs[0].category, Category.SEO);
    assert.equal(recs[0].priority, "Low");
});

test("filters out findings with no recommendation text", () => {
    const recs = generateRecommendations([finding({ recommendation: "" })]);
    assert.equal(recs.length, 0);
});

test("maps every severity level to a priority", () => {
    const recs = generateRecommendations([
        finding({ severity: Severity.CRITICAL, id: "A" }),
        finding({ severity: Severity.HIGH, id: "B" }),
        finding({ severity: Severity.MEDIUM, id: "C" }),
        finding({ severity: Severity.LOW, id: "D" }),
        finding({ severity: Severity.INFO, id: "E" })
    ]);
    assert.deepEqual(
        recs.map(r => r.priority),
        ["Critical", "High", "Medium", "Low", "Low"]
    );
});

test("covers every rule category, not just a hardcoded subset", () => {
    const recs = generateRecommendations([
        finding({ category: Category.ASSETS, id: "A" }),
        finding({ category: Category.FUNCTIONALITY, id: "B" })
    ]);
    assert.equal(recs.length, 2);
});
