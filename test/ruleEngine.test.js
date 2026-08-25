const test = require("node:test");
const assert = require("node:assert/strict");
const { runPerPageRules, collectSummaries, runFinalRules } = require("../src/ruleEngine");

function makeRule(overrides) {
    return {
        id: "TEST",
        name: "Test Rule",
        ...overrides
    };
}

test("runPerPageRules calls runPerPage on every rule that has it", async () => {
    const ruleA = makeRule({ id: "A", runPerPage: (page) => [{ id: "F1", page: page.url }] });
    const ruleB = makeRule({ id: "B", runPerPage: (page) => [{ id: "F2", page: page.url }] });

    const findings = await runPerPageRules({ url: "https://example.com/" }, [ruleA, ruleB]);
    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map(f => f.id).sort(), ["F1", "F2"]);
});

test("runPerPageRules skips rules with no runPerPage method", async () => {
    const finalOnlyRule = makeRule({ id: "FINAL_ONLY", runFinal: () => [] });
    const findings = await runPerPageRules({ url: "https://example.com/" }, [finalOnlyRule]);
    assert.deepEqual(findings, []);
});

test("runPerPageRules catches a throwing rule and continues with the rest", async () => {
    const broken = makeRule({ id: "BROKEN", runPerPage: () => { throw new Error("boom"); } });
    const ok = makeRule({ id: "OK", runPerPage: () => [{ id: "F1" }] });

    const findings = await runPerPageRules({ url: "https://example.com/" }, [broken, ok]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "F1");
});

test("runPerPageRules supports async runPerPage", async () => {
    const rule = makeRule({
        id: "ASYNC",
        runPerPage: async (page) => {
            await new Promise(r => setTimeout(r, 1));
            return [{ id: "F1", page: page.url }];
        }
    });
    const findings = await runPerPageRules({ url: "https://example.com/" }, [rule]);
    assert.equal(findings.length, 1);
});

test("collectSummaries accumulates one entry per page per rule with collectSummary", () => {
    const rule = makeRule({ id: "SUMM", collectSummary: (page) => ({ url: page.url }) });
    const summaries = {};

    collectSummaries({ url: "https://example.com/a" }, [rule], summaries);
    collectSummaries({ url: "https://example.com/b" }, [rule], summaries);

    assert.equal(summaries.SUMM.length, 2);
    assert.equal(summaries.SUMM[0].url, "https://example.com/a");
});

test("collectSummaries ignores rules with no collectSummary", () => {
    const rule = makeRule({ id: "NO_SUMMARY", runPerPage: () => [] });
    const summaries = {};
    collectSummaries({ url: "https://example.com/" }, [rule], summaries);
    assert.deepEqual(summaries, {});
});

test("collectSummaries does not push null/undefined summaries", () => {
    const rule = makeRule({ id: "SOMETIMES", collectSummary: (page) => page.url.includes("skip") ? null : { url: page.url } });
    const summaries = {};
    collectSummaries({ url: "https://example.com/skip" }, [rule], summaries);
    collectSummaries({ url: "https://example.com/keep" }, [rule], summaries);
    assert.equal(summaries.SOMETIMES.length, 1);
});

test("collectSummaries catches a throwing rule and continues", () => {
    const broken = makeRule({ id: "BROKEN", collectSummary: () => { throw new Error("boom"); } });
    const summaries = {};
    assert.doesNotThrow(() => collectSummaries({ url: "https://example.com/" }, [broken], summaries));
});

test("runFinalRules calls runFinal with this rule's own summaries and siteContext", async () => {
    const rule = makeRule({
        id: "DUP",
        runFinal: (summaries, siteContext) => [{ id: "F1", count: summaries.length, url: siteContext.url }]
    });
    const findings = await runFinalRules([rule], { DUP: [{ a: 1 }, { a: 2 }] }, { url: "https://example.com" });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].count, 2);
    assert.equal(findings[0].url, "https://example.com");
});

test("runFinalRules passes an empty array when a rule has no accumulated summaries", async () => {
    const rule = makeRule({
        id: "NO_SUMMARIES",
        runFinal: (summaries) => [{ id: "F1", count: summaries.length }]
    });
    const findings = await runFinalRules([rule], {}, {});
    assert.equal(findings[0].count, 0);
});

test("runFinalRules skips rules with no runFinal method", async () => {
    const perPageOnly = makeRule({ id: "PER_PAGE_ONLY", runPerPage: () => [] });
    const findings = await runFinalRules([perPageOnly], {}, {});
    assert.deepEqual(findings, []);
});

test("runFinalRules catches a throwing rule and continues with the rest", async () => {
    const broken = makeRule({ id: "BROKEN", runFinal: () => { throw new Error("boom"); } });
    const ok = makeRule({ id: "OK", runFinal: () => [{ id: "F1" }] });
    const findings = await runFinalRules([broken, ok], {}, {});
    assert.equal(findings.length, 1);
});
