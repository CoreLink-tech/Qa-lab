const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/seoRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags a page with no H1", () => {
    const model = makeModel([makePage({ headings: { h1: 0, h2: 0, h3: 0 } })]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "SEO001");
});

test("flags a page with multiple H1s", () => {
    const model = makeModel([makePage({ headings: { h1: 3, h2: 0, h3: 0 } })]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "SEO002");
    assert.match(findings[0].details, /3 H1/);
});

test("exactly one H1 produces no findings", () => {
    const model = makeModel([makePage({ headings: { h1: 1, h2: 0, h3: 0 } })]);
    assert.equal(rule.run(model).length, 0);
});
