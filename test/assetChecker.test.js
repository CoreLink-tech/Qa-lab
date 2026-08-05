const test = require("node:test");
const assert = require("node:assert/strict");
const { collectAssetUrls } = require("../src/assetChecker");
const { makePage, makeModel } = require("./helpers/fixtures");

test("collects and resolves script, stylesheet, and image URLs to absolute", () => {
    const model = makeModel([makePage({
        url: "https://example.com/blog/post",
        scripts: [{ src: "/app.js" }],
        stylesheets: [{ href: "../main.css" }],
        images: { sources: ["photo.png"] }
    })]);
    const urls = collectAssetUrls(model).sort();
    assert.deepEqual(urls, [
        "https://example.com/app.js",
        "https://example.com/blog/photo.png",
        "https://example.com/main.css"
    ]);
});

test("dedupes the same asset URL referenced across multiple pages", () => {
    const model = makeModel([
        makePage({ url: "https://example.com/a", scripts: [{ src: "/shared.js" }] }),
        makePage({ url: "https://example.com/b", scripts: [{ src: "/shared.js" }] })
    ]);
    assert.equal(collectAssetUrls(model).length, 1);
});

test("ignores inline scripts (no src)", () => {
    const model = makeModel([makePage({ scripts: [{ src: null, inline: true }] })]);
    assert.equal(collectAssetUrls(model).length, 0);
});

test("skips a malformed asset URL instead of throwing", () => {
    const model = makeModel([makePage({ scripts: [{ src: "http://[::invalid" }] })]);
    assert.doesNotThrow(() => collectAssetUrls(model));
});

test("handles a website model with no pages", () => {
    const model = makeModel([]);
    assert.deepEqual(collectAssetUrls(model), []);
});
