const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/performanceRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags very slow pages (>5000ms) as High severity", () => {
    const model = makeModel([makePage({ responseTime: 6000 })]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "PERF001");
    assert.equal(findings[0].severity, "High");
});

test("flags moderately slow pages (2000-5000ms) as Medium severity", () => {
    const model = makeModel([makePage({ responseTime: 3000 })]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "PERF002");
    assert.equal(findings[0].severity, "Medium");
});

test("fast pages (<2000ms) produce no findings", () => {
    const model = makeModel([makePage({ responseTime: 500 })]);
    assert.equal(rule.run(model).length, 0);
});

test("a page with no numeric responseTime (e.g. a failed fetch) is skipped, not thrown", () => {
    const model = makeModel([makePage({ responseTime: null })]);
    assert.doesNotThrow(() => rule.run(model));
    assert.equal(rule.run(model).length, 0);
});
