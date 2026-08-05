const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/functionalityRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags a page that returned a non-200 status", () => {
    const model = makeModel([makePage({ status: 500 })]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "FUNC001");
});

test("a 200 page produces no findings", () => {
    const model = makeModel([makePage({ status: 200 })]);
    assert.equal(rule.run(model).length, 0);
});
