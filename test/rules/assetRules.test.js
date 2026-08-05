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

test("does not run site-wide asset checks when assetChecks is absent (default, no --check-assets)", () => {
    const model = makeModel([makePage({ scripts: [], stylesheets: [] })]);
    // No websiteModel.assetChecks at all
    assert.equal(rule.run(model).length, 0);
});

test("flags a missing/unreachable asset (404)", () => {
    const model = makeModel([makePage({})]);
    model.assetChecks = {
        "https://example.com/missing.js": { url: "https://example.com/missing.js", status: 404, sizeBytes: null, hash: null, tooLarge: false, error: null }
    };
    const finding = rule.run(model).find(f => f.id === "AST004");
    assert.ok(finding);
    assert.match(finding.details, /404/);
});

test("flags an asset that failed to fetch at all (network error)", () => {
    const model = makeModel([makePage({})]);
    model.assetChecks = {
        "https://example.com/broken.js": { url: "https://example.com/broken.js", status: null, sizeBytes: null, hash: null, tooLarge: false, error: "timeout of 10000ms exceeded" }
    };
    const finding = rule.run(model).find(f => f.id === "AST004");
    assert.ok(finding);
    assert.match(finding.details, /timeout/);
});

test("does not flag a successfully fetched, normal-sized asset", () => {
    const model = makeModel([makePage({})]);
    model.assetChecks = {
        "https://example.com/app.js": { url: "https://example.com/app.js", status: 200, sizeBytes: 5000, hash: "abc", tooLarge: false, error: null }
    };
    assert.equal(rule.run(model).filter(f => f.id === "AST004" || f.id === "AST005").length, 0);
});

test("flags a large asset over the size threshold", () => {
    const model = makeModel([makePage({})]);
    model.assetChecks = {
        "https://example.com/huge.png": { url: "https://example.com/huge.png", status: 200, sizeBytes: 400 * 1024, hash: "abc", tooLarge: false, error: null }
    };
    const finding = rule.run(model).find(f => f.id === "AST005");
    assert.ok(finding);
});

test("flags an asset that was too large to fully download, with reduced confidence", () => {
    const model = makeModel([makePage({})]);
    model.assetChecks = {
        "https://example.com/massive.mp4": { url: "https://example.com/massive.mp4", status: null, sizeBytes: null, hash: null, tooLarge: true, error: null }
    };
    const finding = rule.run(model).find(f => f.id === "AST005");
    assert.ok(finding);
    assert.equal(finding.confidence, 80);
});

test("flags duplicate content served from different URLs", () => {
    const model = makeModel([makePage({})]);
    model.assetChecks = {
        "https://example.com/a.js": { url: "https://example.com/a.js", status: 200, sizeBytes: 100, hash: "samehash", tooLarge: false, error: null },
        "https://example.com/b.js": { url: "https://example.com/b.js", status: 200, sizeBytes: 100, hash: "samehash", tooLarge: false, error: null }
    };
    const finding = rule.run(model).find(f => f.id === "AST006");
    assert.ok(finding);
    assert.match(finding.details, /2 different URLs/);
});

test("does not flag duplicate content when hashes differ", () => {
    const model = makeModel([makePage({})]);
    model.assetChecks = {
        "https://example.com/a.js": { url: "https://example.com/a.js", status: 200, sizeBytes: 100, hash: "hash1", tooLarge: false, error: null },
        "https://example.com/b.js": { url: "https://example.com/b.js", status: 200, sizeBytes: 100, hash: "hash2", tooLarge: false, error: null }
    };
    assert.ok(!rule.run(model).map(f => f.id).includes("AST006"));
});
