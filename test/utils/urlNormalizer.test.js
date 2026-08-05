const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeUrl, removeDuplicates } = require("../../src/utils/urlNormalizer");

test("resolves a relative link against the base URL", () => {
    assert.equal(normalizeUrl("https://example.com/", "/about"), "/about");
});

test("keeps the query string", () => {
    assert.equal(normalizeUrl("https://example.com/", "/search?q=test"), "/search?q=test");
});

test("rejects links to a different host", () => {
    assert.equal(normalizeUrl("https://example.com/", "https://evil.com/phish"), null);
});

test("returns null for a malformed link instead of throwing", () => {
    assert.doesNotThrow(() => normalizeUrl("https://example.com/", "not a url::"));
});

test("removeDuplicates dedupes and drops falsy entries", () => {
    const result = removeDuplicates(["/a", "/a", "/b", null, "/b", undefined]);
    assert.deepEqual(result.sort(), ["/a", "/b"]);
});
