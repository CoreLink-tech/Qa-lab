const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePage } = require("../src/normalizer");

const sampleHtml = `
<html lang="en">
<head>
  <title>Sample Page</title>
  <meta name="description" content="A sample description.">
  <meta name="generator" content="WordPress 6.4">
  <link rel="canonical" href="https://example.com/">
  <meta property="og:title" content="Sample Page">
  <script type="application/ld+json">{}</script>
  <script src="/wp-content/theme.js"></script>
  <link rel="stylesheet" href="/main.css">
  <link rel="stylesheet" href="/main.css">
</head>
<body>
  <h1>Main Heading</h1>
  <h2>Sub Heading</h2>
  <h4>Skipped Level</h4>
  <img src="a.png" alt="a picture">
  <img src="b.png">
  <a href="/about">About</a>
  <a href="https://other.com/x">External</a>
  <form method="post" action="/login">
    <label for="user-email">Email</label>
    <input type="email" id="user-email" name="email">
    <input type="password" name="pw">
    <input type="hidden" name="csrf_token" value="abc">
  </form>
  <img src="http://insecure.example.com/x.png">
  <script>console.log("inline");</script>
</body>
</html>
`;

test("extracts heading sequence in DOM order including a skip", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.deepEqual(result.headingSequence, ["h1", "h2", "h4"]);
});

test("counts images and missing alt text", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.equal(result.images.total, 3); // a.png, b.png, insecure.png
    assert.equal(result.images.missingAlt, 2); // b.png and the insecure one
});

test("extracts meta tags: description, canonical, og:title", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.equal(result.meta.description, "A sample description.");
    assert.equal(result.meta.canonical, "https://example.com/");
    assert.equal(result.meta.ogTitle, "Sample Page");
});

test("counts structured data (ld+json) blocks", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.equal(result.structuredDataCount, 1);
});

test("extracts the html lang attribute", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.equal(result.lang, "en");
});

test("captures label-for targets", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.deepEqual(result.labelFors, ["user-email"]);
});

test("builds a per-form structure with method, action, and CSRF detection", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.equal(result.forms.list.length, 1);
    const form = result.forms.list[0];
    assert.equal(form.method, "post");
    assert.equal(form.action, "/login");
    assert.equal(form.hasCSRFToken, true);
    assert.equal(form.hasFileUpload, false);
    assert.equal(form.fields.length, 3);
});

test("detects mixed content only when the page itself is https", () => {
    const httpsResult = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.equal(httpsResult.mixedContentCount, 1);

    const httpResult = normalizePage({ url: "http://example.com/" }, sampleHtml);
    assert.equal(httpResult.mixedContentCount, 0);
});

test("only collects links from <a> tags, external links included (host filtering happens at crawl time, not here)", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.deepEqual(result.links.sort(), ["/about", "https://other.com/x"]);
});

test("computes htmlSize as the byte length of the input html", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    assert.equal(result.htmlSize, Buffer.byteLength(sampleHtml, "utf8"));
});

test("handles a page with no forms, no headings, and no meta gracefully", () => {
    const result = normalizePage({ url: "https://example.com/empty" }, "<html><body>hi</body></html>");
    assert.equal(result.forms.list.length, 0);
    assert.deepEqual(result.headingSequence, []);
    assert.equal(result.meta.description, null);
    assert.equal(result.lang, null);
});

test("extracts scripts with src, location, and inline status", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    const external = result.scripts.find(s => s.src === "/wp-content/theme.js");
    assert.ok(external);
    assert.equal(external.inline, false);
    assert.equal(external.location, "head");

    // Two inline scripts exist in the sample (the ld+json block in head,
    // and the console.log script in body) -- be specific about which
    // one we're checking rather than relying on find() order.
    const bodyInline = result.scripts.find(s => s.inline === true && s.location === "body");
    assert.ok(bodyInline);
    assert.equal(bodyInline.src, null);
});

test("extracts stylesheets, including duplicates (dedup is the rule's job, not the model's)", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    const mainCssCount = result.stylesheets.filter(s => s.href === "/main.css").length;
    assert.equal(mainCssCount, 2);
});

test("parses cookies from the page's Set-Cookie header into model.cookies", () => {
    const result = normalizePage(
        { url: "https://example.com/", headers: { "set-cookie": "session=abc; Secure; HttpOnly" } },
        sampleHtml
    );
    assert.equal(result.cookies.length, 1);
    assert.equal(result.cookies[0].name, "session");
    assert.equal(result.cookies[0].secure, true);
});

test("detects technologies from generator meta tag and resource paths", () => {
    const result = normalizePage({ url: "https://example.com/" }, sampleHtml);
    const names = result.technologies.map(t => t.name);
    assert.ok(names.includes("WordPress"));
});

test("technologies is an empty array, not an error, when nothing matches", () => {
    const result = normalizePage({ url: "https://example.com/plain" }, "<html><body>plain page</body></html>");
    assert.deepEqual(result.technologies, []);
});
