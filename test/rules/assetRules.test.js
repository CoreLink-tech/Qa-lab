const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/assetRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags a script loaded more than once on the same page", () => {
    const model = makeModel([makePage({
        scripts: [{ src: "/app.js" }, { src: "/app.js" }]
    })]);
    const finding = rule.run(model).find(f => f.id === "AST002");
    assert.ok(finding);
    assert.match(finding.details, /\/app\.js/);
});

test("does not flag scripts that only appear once each", () => {
    const model = makeModel([makePage({
        scripts: [{ src: "/app.js" }, { src: "/vendor.js" }]
    })]);
    assert.equal(rule.run(model).filter(f => f.id === "AST002").length, 0);
});

test("ignores inline scripts (no src) entirely", () => {
    const model = makeModel([makePage({
        scripts: [{ src: null, inline: true }, { src: null, inline: true }]
    })]);
    assert.equal(rule.run(model).filter(f => f.id === "AST002").length, 0);
});

test("flags a stylesheet loaded more than once on the same page", () => {
    const model = makeModel([makePage({
        stylesheets: [{ href: "/main.css" }, { href: "/main.css" }]
    })]);
    const finding = rule.run(model).find(f => f.id === "AST003");
    assert.ok(finding);
    assert.match(finding.details, /\/main\.css/);
});

test("does not flag stylesheets that only appear once each", () => {
    const model = makeModel([makePage({
        stylesheets: [{ href: "/main.css" }, { href: "/theme.css" }]
    })]);
    assert.equal(rule.run(model).filter(f => f.id === "AST003").length, 0);
});

test("a page with no scripts or stylesheets produces no findings", () => {
    const model = makeModel([makePage({ scripts: [], stylesheets: [] })]);
    assert.equal(rule.run(model).length, 0);
});
