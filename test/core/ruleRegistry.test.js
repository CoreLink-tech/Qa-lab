const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { loadRules, loadRulesWithPlugins, validateRule } = require("../../src/core/ruleRegistry");

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

test("loadRulesWithPlugins() with no plugin dirs returns just the built-in rules", () => {
    const rules = loadRulesWithPlugins([]);
    assert.ok(rules.length >= 8);
    assert.ok(!rules.some(r => r.category === "Custom"));
});

test("loadRulesWithPlugins() merges rules from a single plugin directory", () => {
    const rules = loadRulesWithPlugins([path.join(__dirname, "../fixtures/rules-plugin-a")]);
    assert.ok(rules.some(r => r.id === "PLUGIN_A"));
    assert.ok(rules.some(r => r.id === "SEO")); // built-in rules still present
});

test("loadRulesWithPlugins() merges rules from multiple plugin directories", () => {
    const rules = loadRulesWithPlugins([
        path.join(__dirname, "../fixtures/rules-plugin-a"),
        path.join(__dirname, "../fixtures/rules-plugin-b")
    ]);
    assert.ok(rules.some(r => r.id === "PLUGIN_A"));
    assert.ok(rules.some(r => r.id === "PLUGIN_B"));
});

test("loadRulesWithPlugins() skips a plugin rule that collides with an existing id, with a warning, instead of crashing", () => {
    const originalError = console.error;
    const warnings = [];
    console.error = (...args) => warnings.push(args.join(" "));

    let rules;
    try {
        rules = loadRulesWithPlugins([path.join(__dirname, "../fixtures/rules-plugin-collision")]);
    } finally {
        console.error = originalError;
    }

    const seoRules = rules.filter(r => r.id === "SEO");
    assert.equal(seoRules.length, 1);
    assert.equal(seoRules[0].name, "SEO Rules"); // the real built-in one, not the plugin's
    assert.ok(warnings.some(w => w.includes("PLUGIN") === false && w.includes("SEO")));
});

test("loadRulesWithPlugins() throws a clear error when a plugin directory doesn't exist", () => {
    assert.throws(
        () => loadRulesWithPlugins([path.join(__dirname, "../fixtures/does-not-exist")]),
        /Failed to load plugin rules/
    );
});
