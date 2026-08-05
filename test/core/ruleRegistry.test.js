const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { loadRules, validateRule } = require("../../src/core/ruleRegistry");

test("validateRule accepts a well-formed rule", () => {
    assert.doesNotThrow(() => validateRule(
        { id: "X", name: "X", category: "X", run: () => {} },
        "fake.js"
    ));
});

test("validateRule throws a clear error naming the missing field", () => {
    assert.throws(
        () => validateRule({ id: "X", name: "X", category: "X" }, "badRule.js"),
        /badRule\.js.*run/s
    );
});

test("validateRule throws when run is not a function", () => {
    assert.throws(
        () => validateRule({ id: "X", name: "X", category: "X", run: "nope" }, "badRule.js"),
        /run.*function/i
    );
});

test("loadRules() loads only enabled rules from a fixture directory", () => {
    const rules = loadRules(path.join(__dirname, "../fixtures/rules-valid"));
    assert.equal(rules.length, 1);
    assert.equal(rules[0].id, "T1");
});

test("loadRules() throws on a malformed rule file instead of silently breaking", () => {
    assert.throws(
        () => loadRules(path.join(__dirname, "../fixtures/rules-invalid")),
        /badRule\.js/
    );
});

test("loadRules() against the REAL src/rules directory loads every rule without throwing", () => {
    const rules = loadRules();
    assert.ok(rules.length >= 8, `expected at least 8 real rules, got ${rules.length}`);
    rules.forEach(rule => {
        assert.equal(typeof rule.run, "function");
        assert.ok(rule.id);
        assert.ok(rule.category);
    });
});
