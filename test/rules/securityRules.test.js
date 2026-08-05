const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/securityRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags all 4 missing security headers", () => {
    const model = makeModel([makePage({ headers: {} })]);
    const findings = rule.run(model);
    const ids = findings.map(f => f.id).sort();
    assert.deepEqual(ids, ["SEC001", "SEC002", "SEC003", "SEC004"]);
});

test("no findings when all 4 headers are present", () => {
    const model = makeModel([makePage({
        headers: {
            "content-security-policy": "default-src 'self'",
            "x-frame-options": "DENY",
            "strict-transport-security": "max-age=63072000",
            "x-content-type-options": "nosniff"
        }
    })]);
    assert.equal(rule.run(model).length, 0);
});

test("a page with no headers object at all is skipped, not thrown", () => {
    const model = makeModel([makePage({ headers: undefined })]);
    assert.doesNotThrow(() => rule.run(model));
    assert.equal(rule.run(model).length, 0);
});
