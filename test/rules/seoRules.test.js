const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/seoRules");
const { makePage, makeModel } = require("../helpers/fixtures");

function ids(findings) {
    return findings.map(f => f.id).sort();
}

test("flags a page with no H1", () => {
    const model = makeModel([makePage({ headings: { h1: 0 }, title: "Good Title Here", meta: { description: "A description that is a reasonable length for SEO purposes here.", canonical: "https://example.com/", ogTitle: "x" } })]);
    assert.ok(ids(rule.run(model)).includes("SEO001"));
});

test("flags a page with multiple H1s", () => {
    const model = makeModel([makePage({ headings: { h1: 3 }, title: "Good Title Here", meta: { description: "A description that is a reasonable length for SEO purposes here.", canonical: "https://example.com/", ogTitle: "x" } })]);
    const findings = rule.run(model).filter(f => f.id === "SEO002");
    assert.equal(findings.length, 1);
    assert.match(findings[0].details, /3 H1/);
});

test("a fully clean single page produces no findings", () => {
    const model = makeModel([makePage({
        headings: { h1: 1 },
        title: "A Well Formed Page Title",
        meta: {
            description: "A meta description that sits comfortably inside the fifty to one hundred sixty character window.",
            canonical: "https://example.com/",
            ogTitle: "A Well Formed Page Title"
        },
        links: ["/about"]
    })]);
    assert.equal(rule.run(model).length, 0);
});

test("flags a missing title", () => {
    const model = makeModel([makePage({ title: null })]);
    assert.ok(ids(rule.run(model)).includes("SEO003"));
});

test("flags a title that is too short", () => {
    const model = makeModel([makePage({ title: "Hi" })]);
    assert.ok(ids(rule.run(model)).includes("SEO004"));
});

test("flags a title that is too long", () => {
    const model = makeModel([makePage({ title: "A".repeat(80) })]);
    assert.ok(ids(rule.run(model)).includes("SEO004"));
});

test("flags a missing meta description", () => {
    const model = makeModel([makePage({ meta: { description: null } })]);
    assert.ok(ids(rule.run(model)).includes("SEO005"));
});

test("flags a meta description that is too short", () => {
    const model = makeModel([makePage({ meta: { description: "Too short." } })]);
    assert.ok(ids(rule.run(model)).includes("SEO006"));
});

test("flags a missing canonical tag", () => {
    const model = makeModel([makePage({ meta: { canonical: null } })]);
    assert.ok(ids(rule.run(model)).includes("SEO007"));
});

test("flags missing Open Graph tags", () => {
    const model = makeModel([makePage({ meta: { ogTitle: null, ogDescription: null } })]);
    assert.ok(ids(rule.run(model)).includes("SEO008"));
});

test("does not flag Open Graph when at least og:title is present", () => {
    const model = makeModel([makePage({ meta: { ogTitle: "Something", ogDescription: null } })]);
    assert.ok(!ids(rule.run(model)).includes("SEO008"));
});

test("flags a duplicate title used on multiple pages", () => {
    const model = makeModel([
        makePage({ url: "https://example.com/a", title: "Same Title Here" }),
        makePage({ url: "https://example.com/b", title: "Same Title Here" })
    ]);
    const dupes = rule.run(model).filter(f => f.id === "SEO009");
    assert.equal(dupes.length, 1);
    assert.match(dupes[0].details, /2 pages/);
});

test("does not flag unique titles across pages", () => {
    const model = makeModel([
        makePage({ url: "https://example.com/a", title: "Title A Is Unique" }),
        makePage({ url: "https://example.com/b", title: "Title B Is Unique" })
    ]);
    assert.ok(!ids(rule.run(model)).includes("SEO009"));
});

test("flags a duplicate meta description used on multiple pages", () => {
    const desc = "This exact same description text appears on more than one page in the site.";
    const model = makeModel([
        makePage({ url: "https://example.com/a", meta: { description: desc } }),
        makePage({ url: "https://example.com/b", meta: { description: desc } })
    ]);
    assert.ok(ids(rule.run(model)).includes("SEO010"));
});

test("flags a successfully loaded page with zero internal links", () => {
    const model = makeModel([makePage({ status: 200, links: [] })]);
    assert.ok(ids(rule.run(model)).includes("SEO011"));
});

test("does not flag internal links when a page has at least one link", () => {
    const model = makeModel([makePage({ status: 200, links: ["/about"] })]);
    assert.ok(!ids(rule.run(model)).includes("SEO011"));
});

test("does not flag internal links on a page that failed to load", () => {
    const model = makeModel([makePage({ status: 404, links: [] })]);
    assert.ok(!ids(rule.run(model)).includes("SEO011"));
});
