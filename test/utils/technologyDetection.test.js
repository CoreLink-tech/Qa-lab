const test = require("node:test");
const assert = require("node:assert/strict");
const { detectTechnologies } = require("../../src/utils/technologyDetection");

function names(techs) {
    return techs.map(t => t.name);
}

test("detects WordPress from a wp-content resource path", () => {
    const result = detectTechnologies({ resourcePaths: ["/wp-content/themes/x/style.css"] });
    assert.ok(names(result).includes("WordPress"));
});

test("detects WordPress from the generator meta tag", () => {
    const result = detectTechnologies({ generator: "WordPress 6.4" });
    assert.ok(names(result).includes("WordPress"));
});

test("detects Cloudflare from the server header", () => {
    const result = detectTechnologies({ headers: { server: "cloudflare" } });
    assert.ok(names(result).includes("Cloudflare"));
});

test("detects PHP from the PHPSESSID cookie name", () => {
    const result = detectTechnologies({ cookieNames: ["PHPSESSID"] });
    assert.ok(names(result).includes("PHP"));
});

test("detects jQuery from a resource path", () => {
    const result = detectTechnologies({ resourcePaths: ["https://cdn.example.com/jquery-3.6.0.min.js"] });
    assert.ok(names(result).includes("jQuery"));
});

test("returns an empty array when nothing matches", () => {
    const result = detectTechnologies({ generator: "", resourcePaths: [], headers: {}, cookieNames: [] });
    assert.deepEqual(result, []);
});

test("handles completely missing context without throwing", () => {
    assert.doesNotThrow(() => detectTechnologies({}));
});

test("can detect multiple technologies at once", () => {
    const result = detectTechnologies({
        headers: { server: "cloudflare", "x-powered-by": "PHP/8.1" },
        resourcePaths: ["/wp-content/x.js", "https://www.googletagmanager.com/gtag.js"]
    });
    const found = names(result);
    assert.ok(found.includes("Cloudflare"));
    assert.ok(found.includes("PHP"));
    assert.ok(found.includes("WordPress"));
    assert.ok(found.includes("Google Analytics / Tag Manager"));
});
