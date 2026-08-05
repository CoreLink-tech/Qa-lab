const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/accessibilityRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags images missing alt attributes", () => {
    const model = makeModel([makePage({ images: { total: 3, missingAlt: 2 } })]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "ACC001");
    assert.match(findings[0].details, /2 image\(s\)/);
});

test("does not flag pages where every image has alt text", () => {
    const model = makeModel([makePage({ images: { total: 3, missingAlt: 0 } })]);
    assert.equal(rule.run(model).length, 0);
});
