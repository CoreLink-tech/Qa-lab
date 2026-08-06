const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { fetchSitemapUrls, discoverSitemapUrls } = require("../src/sitemapParser");

let server;
let baseUrl;

test.before(async () => {
    const routes = {
        "/sitemap.xml": `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>__BASE__/</loc></url>
<url><loc>__BASE__/about</loc></url>
<url><loc>__BASE__/products</loc></url>
</urlset>`,
        "/sitemap-index.xml": `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>__BASE__/sitemap-part1.xml</loc></sitemap>
<sitemap><loc>__BASE__/sitemap-part2.xml</loc></sitemap>
</sitemapindex>`,
        "/sitemap-part1.xml": `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>__BASE__/part1-page</loc></url>
</urlset>`,
        "/sitemap-part2.xml": `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>__BASE__/part2-page</loc></url>
</urlset>`,
        "/empty.xml": "not valid xml at all {{{",
        "/robots.txt": "User-agent: *\nSitemap: __BASE__/sitemap.xml"
    };

    server = http.createServer((req, res) => {
        if (routes[req.url] !== undefined) {
            res.writeHead(200, { "Content-Type": "application/xml" });
            res.end(routes[req.url].replaceAll("__BASE__", baseUrl));
            return;
        }
        res.writeHead(404);
        res.end();
    });

    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise(resolve => server.close(resolve));
});

test("parses a standard sitemap with <url><loc> entries", async () => {
    const urls = await fetchSitemapUrls(baseUrl + "/sitemap.xml");
    assert.deepEqual(urls.sort(), [baseUrl + "/", baseUrl + "/about", baseUrl + "/products"].sort());
});

test("follows a sitemap index to its sub-sitemaps and merges results", async () => {
    const urls = await fetchSitemapUrls(baseUrl + "/sitemap-index.xml");
    assert.deepEqual(urls.sort(), [baseUrl + "/part1-page", baseUrl + "/part2-page"].sort());
});

test("returns an empty array for a 404 sitemap instead of throwing", async () => {
    const urls = await fetchSitemapUrls(baseUrl + "/does-not-exist.xml");
    assert.deepEqual(urls, []);
});

test("returns an empty array for malformed XML instead of throwing", async () => {
    const urls = await fetchSitemapUrls(baseUrl + "/empty.xml");
    assert.deepEqual(urls, []);
});

test("discoverSitemapUrls uses the robots.txt-advertised sitemap first", async () => {
    const urls = await discoverSitemapUrls(baseUrl + "/", { sitemaps: [baseUrl + "/sitemap.xml"] });
    assert.equal(urls.length, 3);
});

test("discoverSitemapUrls falls back to conventional /sitemap.xml when robots.txt has none", async () => {
    const urls = await discoverSitemapUrls(baseUrl + "/", { sitemaps: [] });
    assert.equal(urls.length, 3);
});

test("discoverSitemapUrls returns empty when nothing is found anywhere", async () => {
    const urls = await discoverSitemapUrls("http://127.0.0.1:1/", { sitemaps: [] });
    assert.deepEqual(urls, []);
});
