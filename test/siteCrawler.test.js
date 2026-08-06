const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { crawlSite } = require("../src/siteCrawler");

// Link graph:
//   /  -> /a1, /a2, / (self-link), /disallowed
//   /a1 -> /b1, /b2
//   /a2 -> /b3, /a1 (cross-link back to an already-visited page)
//   /b1, /b2, /b3 -> /c1 (all three link to the SAME leaf -- dedup test)
//   /c1 -> (leaf, no links)
//   /disallowed -> blocked by robots.txt
let server;
let baseUrl;

function page(links) {
    return `<html><body>${links.map(l => `<a href="${l}">x</a>`).join("")}</body></html>`;
}

test.before(async () => {
    const routes = {
        "/": page(["/a1", "/a2", "/", "/disallowed"]),
        "/a1": page(["/b1", "/b2"]),
        "/a2": page(["/b3", "/a1"]),
        "/b1": page(["/c1"]),
        "/b2": page(["/c1"]),
        "/b3": page(["/c1"]),
        "/c1": page([]),
        "/disallowed": page([]),
        "/sitemap-only-page": page([]),
        "/robots.txt": "User-agent: *\nDisallow: /disallowed"
    };

    routes["/sitemap.xml"] = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>PLACEHOLDER/sitemap-only-page</loc></url>
</urlset>`;

    server = http.createServer((req, res) => {
        if (routes[req.url] !== undefined) {
            const contentType = req.url.endsWith(".xml") ? "application/xml" : "text/html";
            res.writeHead(200, { "Content-Type": contentType });
            res.end(routes[req.url].replaceAll("PLACEHOLDER", baseUrl));
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

test("depth 0 fetches only the seed page", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 0, maxPages: 100 });
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].url, baseUrl + "/");
});

test("depth 1 fetches the seed plus its direct links, excluding disallowed and the self-link", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 1, maxPages: 100 });
    const urls = result.pages.map(p => p.url).sort();
    assert.deepEqual(urls, [baseUrl + "/", baseUrl + "/a1", baseUrl + "/a2"]);
});

test("depth 2 follows links two levels deep with global dedup (a1 reached from both / and /a2, fetched once)", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 2, maxPages: 100 });
    const urls = result.pages.map(p => p.url).sort();
    assert.deepEqual(urls, [
        baseUrl + "/", baseUrl + "/a1", baseUrl + "/a2",
        baseUrl + "/b1", baseUrl + "/b2", baseUrl + "/b3"
    ]);
});

test("depth 3 reaches the shared leaf page exactly once despite 3 pages linking to it", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 3, maxPages: 100 });
    const c1Count = result.pages.filter(p => p.url === baseUrl + "/c1").length;
    assert.equal(c1Count, 1);
    assert.equal(result.pages.length, 7); // /, a1, a2, b1, b2, b3, c1
    assert.equal(result.truncated, false);
});

test("maxPages caps total fetched pages and reports truncated", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 5, maxPages: 3 });
    assert.equal(result.pages.length, 3);
    assert.equal(result.truncated, true);
});

test("robots.txt is respected by default: /disallowed is never fetched", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 2, maxPages: 100 });
    assert.ok(!result.pages.some(p => p.url === baseUrl + "/disallowed"));
    assert.ok(result.robotsBlockedCount >= 1);
});

test("respectRobots:false includes disallowed pages", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 1, maxPages: 100, respectRobots: false });
    assert.ok(result.pages.some(p => p.url === baseUrl + "/disallowed"));
});

test("the seed URL itself is always fetched even if robots.txt would disallow it", async () => {
    const result = await crawlSite(baseUrl + "/disallowed", { maxDepth: 0, maxPages: 100 });
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].url, baseUrl + "/disallowed");
});

test("each fetched page records its crawl depth", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 2, maxPages: 100 });
    const seed = result.pages.find(p => p.url === baseUrl + "/");
    const level1 = result.pages.find(p => p.url === baseUrl + "/a1");
    const level2 = result.pages.find(p => p.url === baseUrl + "/b1");
    assert.equal(seed.depth, 0);
    assert.equal(level1.depth, 1);
    assert.equal(level2.depth, 2);
});

test("useSitemap:true folds sitemap-discovered URLs into the depth-1 batch", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 1, maxPages: 100, useSitemap: true });
    // /sitemap-only-page is NOT linked from any crawled page, only listed
    // in sitemap.xml -- if this shows up, sitemap folding worked.
    assert.ok(result.pages.some(p => p.url === baseUrl + "/sitemap-only-page"));
});

test("useSitemap:false (default) never discovers sitemap-only pages", async () => {
    const result = await crawlSite(baseUrl + "/", { maxDepth: 2, maxPages: 100 });
    assert.ok(!result.pages.some(p => p.url === baseUrl + "/sitemap-only-page"));
});

test("excludePatterns prevents matching links from being crawled", async () => {
    const result = await crawlSite(baseUrl + "/", {
        maxDepth: 1, maxPages: 100,
        excludePatterns: [/\/a2$/]
    });
    const urls = result.pages.map(p => p.url);
    assert.ok(!urls.includes(baseUrl + "/a2"));
    assert.ok(urls.includes(baseUrl + "/a1"));
});

test("includePatterns restricts crawling to only matching links", async () => {
    const result = await crawlSite(baseUrl + "/", {
        maxDepth: 1, maxPages: 100,
        includePatterns: [/\/a1$/]
    });
    const urls = result.pages.map(p => p.url);
    assert.ok(urls.includes(baseUrl + "/a1"));
    assert.ok(!urls.includes(baseUrl + "/a2"));
});

test("exclude takes precedence when a path matches both include and exclude", async () => {
    const result = await crawlSite(baseUrl + "/", {
        maxDepth: 1, maxPages: 100,
        includePatterns: [/\/a1$/],
        excludePatterns: [/\/a1$/]
    });
    const urls = result.pages.map(p => p.url);
    assert.ok(!urls.includes(baseUrl + "/a1"));
});
