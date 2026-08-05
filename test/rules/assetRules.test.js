const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/assetRules");
const { makePage, makeModel } = require("../helpers/fixtures");

test("flags a .js/.css link with no matching scanned page", () => {
    const model = makeModel([
        makePage({ url: "https://example.com/", links: ["script.js"] })
    ]);
    const findings = rule.run(model);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "AST001");
});

test("does not flag when the link string exactly matches an already-scanned page's absolute url", () => {
    const model = makeModel([
        makePage({ url: "https://example.com/", links: ["https://example.com/style.css"] }),
        makePage({ url: "https://example.com/style.css" })
    ]);
    assert.equal(rule.run(model).length, 0);
});

test("a link with no .js/.css extension is ignored entirely", () => {
    const model = makeModel([
        makePage({ url: "https://example.com/", links: ["/about"] })
    ]);
    assert.equal(rule.run(model).length, 0);
});

// KNOWN LIMITATION, surfaced by writing these tests rather than fixed here:
// This rule only looks at page.links, which is built from <a href> tags
// during crawling. It never sees <script src> or <link rel="stylesheet">
// references at all, since neither the crawler nor the website model
// capture those today. In practice this means AST001 almost never fires
// on a real site (script/stylesheet refs aren't usually <a> tags), and
// on the rare case it does match a candidate, it compares a raw/relative
// href string against fully-resolved absolute page URLs, which will
// rarely line up even when the asset is perfectly fine. This rule needs
// the website model to actually capture script/stylesheet resources
// (Phase 3: Expand the Website Model) before it can do its stated job.
