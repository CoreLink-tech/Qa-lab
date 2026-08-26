const test = require("node:test");
const assert = require("node:assert/strict");
const { aggregateFindings } = require("../src/findingAggregator");

function finding(overrides = {}) {
    return {
        id: "SEC005",
        title: "Site Not Served Over HTTPS",
        category: "Security",
        severity: "High",
        page: "https://example.com/",
        details: "Page was loaded over plain HTTP.",
        recommendation: "Serve all traffic over HTTPS.",
        documentation: "https://example.com/docs",
        ...overrides
    };
}

test("groups multiple findings with the same id into one entry", () => {
    const findings = [
        finding({ page: "https://example.com/" }),
        finding({ page: "https://example.com/login" }),
        finding({ page: "https://example.com/products" })
    ];
    const groups = aggregateFindings(findings);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].id, "SEC005");
    assert.equal(groups[0].occurrenceCount, 3);
    assert.equal(groups[0].affectedPageCount, 3);
});

test("keeps findings with different ids as separate entries", () => {
    const findings = [
        finding({ id: "SEC005" }),
        finding({ id: "SEO001", title: "Missing H1", category: "SEO", severity: "Low" })
    ];
    const groups = aggregateFindings(findings);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups.map(g => g.id).sort(), ["SEC005", "SEO001"]);
});

test("affectedPages de-duplicates repeated page URLs", () => {
    const findings = [
        finding({ page: "https://example.com/a" }),
        finding({ page: "https://example.com/a" }), // same page, e.g. two cookie issues on one page merged upstream
        finding({ page: "https://example.com/b" })
    ];
    const groups = aggregateFindings(findings);
    assert.equal(groups[0].occurrenceCount, 3);
    assert.equal(groups[0].affectedPageCount, 2);
    assert.deepEqual(groups[0].affectedPages.sort(), ["https://example.com/a", "https://example.com/b"]);
});

test("findings with an empty page field don't count as an affected page", () => {
    const findings = [finding({ page: "" }), finding({ page: "" })];
    const groups = aggregateFindings(findings);
    assert.equal(groups[0].occurrenceCount, 2);
    assert.equal(groups[0].affectedPageCount, 0);
    assert.deepEqual(groups[0].affectedPages, []);
});

test("examples caps at 5 even with many more occurrences", () => {
    const findings = Array.from({ length: 50 }, (_, i) => finding({ page: `https://example.com/${i}` }));
    const groups = aggregateFindings(findings);
    assert.equal(groups[0].occurrenceCount, 50);
    assert.equal(groups[0].affectedPageCount, 50);
    assert.equal(groups[0].examples.length, 5);
});

test("preserves title/category/severity/recommendation/documentation from the finding", () => {
    const groups = aggregateFindings([finding()]);
    assert.equal(groups[0].title, "Site Not Served Over HTTPS");
    assert.equal(groups[0].category, "Security");
    assert.equal(groups[0].severity, "High");
    assert.equal(groups[0].recommendation, "Serve all traffic over HTTPS.");
    assert.equal(groups[0].documentation, "https://example.com/docs");
});

test("returns an empty array for no findings", () => {
    assert.deepEqual(aggregateFindings([]), []);
});

test("a single occurrence still produces a valid group", () => {
    const groups = aggregateFindings([finding()]);
    assert.equal(groups[0].occurrenceCount, 1);
    assert.equal(groups[0].affectedPageCount, 1);
});
