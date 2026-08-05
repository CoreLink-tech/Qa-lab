const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { fetchPage } = require("../src/pageFetcher");

let server;
let baseUrl;

test.before(async () => {
    server = http.createServer((req, res) => {
        if (req.url === "/") {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`<html><head><title>Home</title></head><body>
                <a href="/about">About</a>
                <a href="/contact">Contact</a>
                <a href="">Empty href</a>
            </body></html>`);
            return;
        }
        if (req.url === "/broken") {
            res.writeHead(500);
            res.end("server error");
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

test("fetches a page and extracts title, status, and raw links", async () => {
    const page = await fetchPage(baseUrl + "/");
    assert.equal(page.status, 200);
    assert.equal(page.title, "Home");
    assert.deepEqual(page.rawLinks, ["/about", "/contact"]);
    assert.ok(page.responseTime >= 0);
});

test("handles a server error without throwing", async () => {
    const page = await fetchPage(baseUrl + "/broken");
    assert.doesNotThrow(() => page);
    assert.equal(page.status, 500);
    assert.equal(page.rawLinks.length, 0);
});

test("handles a completely unreachable host without throwing", async () => {
    const page = await fetchPage("http://127.0.0.1:1/nope");
    assert.ok(page.error);
    assert.equal(page.html, "");
});
