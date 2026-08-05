const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/formRules");
const { makePage, makeModel } = require("../helpers/fixtures");

function ids(findings) {
    return findings.map(f => f.id);
}

test("flags input fields missing a name attribute", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "text", name: null }] }
    })]);
    assert.ok(ids(rule.run(model)).includes("FORM001"));
});

test("flags a password field with no autocomplete attribute", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "password", name: "pw", autocomplete: null, minlength: "8" }] }
    })]);
    assert.ok(ids(rule.run(model)).includes("FORM002"));
});

test("does not flag a password field that has autocomplete set", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "password", name: "pw", autocomplete: "new-password", minlength: "8" }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM002"));
});

test("clean form with named fields and no password input produces no findings", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "text", name: "search", autocomplete: "on" }] }
    })]);
    assert.equal(rule.run(model).length, 0);
});

test("flags a password field with no minlength or pattern as no strength requirement", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "password", name: "pw", autocomplete: "new-password", minlength: null, pattern: null }] }
    })]);
    const finding = rule.run(model).find(f => f.id === "FORM003");
    assert.ok(finding);
    assert.equal(finding.confidence, 70);
});

test("does not flag a password field with minlength set", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "password", name: "pw", autocomplete: "new-password", minlength: "8", pattern: null }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM003"));
});

test("flags a field named 'email' that isn't type=email", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "text", name: "user_email" }] }
    })]);
    assert.ok(ids(rule.run(model)).includes("FORM004"));
});

test("does not flag a field named 'email' that is correctly typed", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "email", name: "user_email" }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM004"));
});

test("does not flag unrelated field names for email typing", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "text", name: "full_name" }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM004"));
});

test("flags a file input with no accept attribute", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "file", name: "upload", accept: null }] }
    })]);
    assert.ok(ids(rule.run(model)).includes("FORM007"));
});

test("does not flag a file input that restricts accepted types", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "file", name: "upload", accept: "image/*" }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM007"));
});

test("flags a form with a password field using GET method", () => {
    const model = makeModel([makePage({
        forms: { list: [{ method: "get", action: "/login", hasFileUpload: false, hasCSRFToken: false, fields: [{ type: "password", name: "pw" }] }] }
    })]);
    const finding = rule.run(model).find(f => f.id === "FORM005");
    assert.ok(finding);
    assert.equal(finding.severity, "High");
});

test("does not flag a password form using POST method", () => {
    const model = makeModel([makePage({
        forms: { list: [{ method: "post", action: "/login", hasFileUpload: false, hasCSRFToken: true, fields: [{ type: "password", name: "pw" }] }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM005"));
});

test("flags a POST form with no apparent CSRF token", () => {
    const model = makeModel([makePage({
        forms: { list: [{ method: "post", action: "/contact", hasFileUpload: false, hasCSRFToken: false, fields: [] }] }
    })]);
    const finding = rule.run(model).find(f => f.id === "FORM006");
    assert.ok(finding);
    assert.equal(finding.confidence, 50);
});

test("does not flag a POST form that has a CSRF-shaped hidden field", () => {
    const model = makeModel([makePage({
        forms: { list: [{ method: "post", action: "/contact", hasFileUpload: false, hasCSRFToken: true, fields: [] }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM006"));
});

test("does not flag GET forms for missing CSRF token", () => {
    const model = makeModel([makePage({
        forms: { list: [{ method: "get", action: "/search", hasFileUpload: false, hasCSRFToken: false, fields: [] }] }
    })]);
    assert.ok(!ids(rule.run(model)).includes("FORM006"));
});
