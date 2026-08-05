const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/formRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags input fields missing a name attribute", () => {
    const model = makeModel([makePage({
        forms: { total: 1, inputs: 1, buttons: 0, fields: [{ type: "text", name: null, autocomplete: null }] }
    })]);
    const findings = rule.run(model);
    assert.equal(findings.filter(f => f.id === "FORM001").length, 1);
});

test("flags a password field with no autocomplete attribute", () => {
    const model = makeModel([makePage({
        forms: { total: 1, inputs: 1, buttons: 0, fields: [{ type: "password", name: "pw", autocomplete: null }] }
    })]);
    const findings = rule.run(model);
    assert.equal(findings.filter(f => f.id === "FORM002").length, 1);
});

test("does not flag a password field that has autocomplete set", () => {
    const model = makeModel([makePage({
        forms: { total: 1, inputs: 1, buttons: 0, fields: [{ type: "password", name: "pw", autocomplete: "new-password" }] }
    })]);
    assert.equal(rule.run(model).length, 0);
});

test("clean form with named fields and no password input produces no findings", () => {
    const model = makeModel([makePage({
        forms: { total: 1, inputs: 1, buttons: 1, fields: [{ type: "text", name: "email", autocomplete: "email" }] }
    })]);
    assert.equal(rule.run(model).length, 0);
});
