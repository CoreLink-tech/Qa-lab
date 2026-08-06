const test = require("node:test");
const assert = require("node:assert/strict");
const { compareScans, findingKey } = require("../src/scanComparison");

function report(overrides = {}) {
    return {
        timestamp: "2026-01-01T00:00:00.000Z",
        score: { score: 80 },
        findings: [],
        ...overrides
    };
}

test("findingKey combines id and page for identity across scans", () => {
    assert.equal(
        findingKey({ id: "SEO001", page: "https://example.com/" }),
        "SEO001::https://example.com/"
    );
});

test("computes score delta correctly (both improvement and regression)", () => {
    const improved = compareScans(report({ score: { score: 70 } }), report({ score: { score: 85 } }));
    assert.equal(improved.scoreDelta, 15);

    const regressed = compareScans(report({ score: { score: 85 } }), report({ score: { score: 70 } }));
    assert.equal(regressed.scoreDelta, -15);
});

test("identifies a finding present now but not before as a new issue", () => {
    const previous = report({ findings: [] });
    const current = report({ findings: [{ id: "SEO001", page: "https://example.com/", title: "Missing H1" }] });

    const result = compareScans(previous, current);
    assert.equal(result.newIssues.length, 1);
    assert.equal(result.newIssues[0].title, "Missing H1");
    assert.equal(result.resolvedIssues.length, 0);
});

test("identifies a finding present before but not now as resolved", () => {
    const previous = report({ findings: [{ id: "SEO001", page: "https://example.com/", title: "Missing H1" }] });
    const current = report({ findings: [] });

    const result = compareScans(previous, current);
    assert.equal(result.resolvedIssues.length, 1);
    assert.equal(result.resolvedIssues[0].title, "Missing H1");
    assert.equal(result.newIssues.length, 0);
});

test("a finding on the same id and page in both scans is neither new nor resolved", () => {
    const finding = { id: "SEO001", page: "https://example.com/", title: "Missing H1" };
    const result = compareScans(report({ findings: [finding] }), report({ findings: [finding] }));
    assert.equal(result.newIssues.length, 0);
    assert.equal(result.resolvedIssues.length, 0);
});

test("the same rule id on a DIFFERENT page counts as a distinct issue instance", () => {
    const previous = report({ findings: [{ id: "SEO001", page: "https://example.com/a", title: "Missing H1" }] });
    const current = report({ findings: [{ id: "SEO001", page: "https://example.com/b", title: "Missing H1" }] });

    const result = compareScans(previous, current);
    assert.equal(result.newIssues.length, 1);
    assert.equal(result.resolvedIssues.length, 1);
});

test("handles a null previous scan (first-ever scan) without throwing", () => {
    assert.doesNotThrow(() => compareScans(null, report({ findings: [{ id: "X", page: "y" }] })));
    const result = compareScans(null, report({ findings: [{ id: "X", page: "y" }] }));
    assert.equal(result.newIssues.length, 1);
    assert.equal(result.previousScore, null);
    assert.equal(result.scoreDelta, null);
});
