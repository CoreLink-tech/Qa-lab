const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/linkRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags a page with a 404 status", () => {
    const model = makeModel([makePage({ status: 404 })]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "LINK001");
});

test("does not flag a healthy 200 page", () => {
    const model = makeModel([makePage({ status: 200 })]);
    assert.equal(rule.run(model).length, 0);
});
