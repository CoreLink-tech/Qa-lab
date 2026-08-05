const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { checkAssets } = require("../src/assetChecker");
const { makePage, makeModel } = require("./helpers/fixtures");

// Spins up a real local server for the duration of this file so
// checkAssets() is tested against actual HTTP behavior, not mocks.
let server;
let baseUrl;

test.before(async () => {
    server = http.createServer((req, res) => {
        if (req.url === "/a.js") { res.writeHead(200); res.end("console.log('a')"); return; }
        // Same content as a.js, different URL -- for duplicate detection.
        if (req.url === "/a-copy.js") { res.writeHead(200); res.end("console.log('a')"); return; }
        if (req.url === "/b.css") { res.writeHead(200); res.end("body { color: red; }"); return; }
        if (req.url === "/missing.js") { res.writeHead(404); res.end("not found"); return; }
        if (req.url === "/huge.js") { res.writeHead(200); res.end("x".repeat(10 * 1024 * 1024)); return; }
        res.writeHead(404); res.end();
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise(resolve => server.close(resolve));
});

test("fetches an asset successfully and returns status, size, and a content hash", async () => {
    const model = makeModel([makePage({ url: baseUrl + "/", scripts: [{ src: "/a.js" }] })]);
    const results = await checkAssets(model, { concurrency: 3 });
    const result = results[baseUrl + "/a.js"];
    assert.equal(result.status, 200);
    assert.ok(result.sizeBytes > 0);
    assert.ok(result.hash);
    assert.equal(result.error, null);
});

test("identical content at different URLs produces the same hash", async () => {
    const model = makeModel([makePage({ url: baseUrl + "/", scripts: [{ src: "/a.js" }, { src: "/a-copy.js" }] })]);
    const results = await checkAssets(model, { concurrency: 3 });
    assert.equal(results[baseUrl + "/a.js"].hash, results[baseUrl + "/a-copy.js"].hash);
});

test("records a 404 asset with its status, not as a thrown error", async () => {
    const model = makeModel([makePage({ url: baseUrl + "/", scripts: [{ src: "/missing.js" }] })]);
    const results = await checkAssets(model, { concurrency: 3 });
    const result = results[baseUrl + "/missing.js"];
    assert.equal(result.status, 404);
});

test("marks an oversized asset as tooLarge instead of downloading it fully", async () => {
    const model = makeModel([makePage({ url: baseUrl + "/", scripts: [{ src: "/huge.js" }] })]);
    const results = await checkAssets(model, { concurrency: 3 });
    const result = results[baseUrl + "/huge.js"];
    assert.equal(result.tooLarge, true);
});

test("dedupes identical asset URLs across pages into one fetch", async () => {
    const model = makeModel([
        makePage({ url: baseUrl + "/", scripts: [{ src: "/a.js" }] }),
        makePage({ url: baseUrl + "/other", scripts: [{ src: "/a.js" }] })
    ]);
    const results = await checkAssets(model, { concurrency: 3 });
    assert.equal(Object.keys(results).length, 1);
});
