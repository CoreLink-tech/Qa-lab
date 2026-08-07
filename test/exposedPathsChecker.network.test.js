const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { checkExposedPaths } = require("../src/exposedPathsChecker");

let server;
let baseUrl;

// Simulates a site that: leaks a real .env, leaks a real .git/HEAD,
// has directory listing enabled on /uploads/, has an admin panel at the
// default path, is missing security.txt, and returns real 404s for
// everything else (so the baseline check behaves normally).
test.before(async () => {
    server = http.createServer((req, res) => {
        if (req.url === "/.env") {
            res.writeHead(200);
            res.end("DB_PASSWORD=supersecret\nDB_NAME=prod\n");
            return;
        }
        if (req.url === "/.git/HEAD") {
            res.writeHead(200);
            res.end("ref: refs/heads/main\n");
            return;
        }
        if (req.url === "/uploads/") {
            res.writeHead(200);
            res.end("<html><title>Index of /uploads/</title><body>a.jpg</body></html>");
            return;
        }
        if (req.url === "/admin") {
            res.writeHead(200);
            res.end("<html><body>Login</body></html>");
            return;
        }
        res.writeHead(404);
        res.end("Not Found");
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise(resolve => server.close(resolve));
});

test("flags a real .env file by its signature, not just its status code", async () => {
    const result = await checkExposedPaths(baseUrl, { concurrency: 3 });
    const found = result.exposed.find(e => e.path === "/.env");
    assert.ok(found);
    assert.equal(found.category, "sensitive-file");
});

test("flags a real exposed .git/HEAD", async () => {
    const result = await checkExposedPaths(baseUrl, { concurrency: 3 });
    assert.ok(result.exposed.some(e => e.path === "/.git/HEAD"));
});

test("flags directory listing via the Index-of signature", async () => {
    const result = await checkExposedPaths(baseUrl, { concurrency: 3 });
    const found = result.exposed.find(e => e.path === "/uploads/");
    assert.ok(found);
    assert.equal(found.category, "directory-listing");
});

test("flags a discoverable admin panel as recon, separate from sensitive-file findings", async () => {
    const result = await checkExposedPaths(baseUrl, { concurrency: 3 });
    const found = result.exposed.find(e => e.path === "/admin");
    assert.ok(found);
    assert.equal(found.category, "recon");
});

test("does not flag paths that genuinely 404", async () => {
    const result = await checkExposedPaths(baseUrl, { concurrency: 3 });
    assert.ok(!result.exposed.some(e => e.path === "/backup.sql"));
    assert.ok(!result.exposed.some(e => e.path === "/wp-config.php.bak"));
});

test("reports hasSecurityTxt: false when the site has no security.txt", async () => {
    const result = await checkExposedPaths(baseUrl, { concurrency: 3 });
    assert.equal(result.hasSecurityTxt, false);
});

test("a soft-404 site (200 for everything) does not produce false positives for unsigned paths", async () => {
    const softServer = http.createServer((req, res) => {
        res.writeHead(200);
        res.end("<html><body>Welcome to our site!</body></html>");
    });
    await new Promise(resolve => softServer.listen(0, "127.0.0.1", resolve));
    const softBaseUrl = `http://127.0.0.1:${softServer.address().port}`;

    try {
        const result = await checkExposedPaths(softBaseUrl, { concurrency: 3 });
        // .DS_Store and admin paths have no distinguishing signature, so on
        // a site that returns 200 for literally everything, they must NOT
        // be reported -- there's nothing to tell them apart from the
        // baseline "page doesn't exist" response.
        assert.ok(!result.exposed.some(e => e.path === "/.DS_Store"));
        assert.ok(!result.exposed.some(e => e.path === "/admin"));
    } finally {
        await new Promise(resolve => softServer.close(resolve));
    }
});

test("a soft-404 site still flags a signature-bearing file if the signature genuinely differs from the baseline", async () => {
    const softServer = http.createServer((req, res) => {
        if (req.url === "/.env") {
            res.writeHead(200);
            res.end("DB_PASSWORD=leaked\n");
            return;
        }
        res.writeHead(200);
        res.end("<html><body>Welcome to our site!</body></html>");
    });
    await new Promise(resolve => softServer.listen(0, "127.0.0.1", resolve));
    const softBaseUrl = `http://127.0.0.1:${softServer.address().port}`;

    try {
        const result = await checkExposedPaths(softBaseUrl, { concurrency: 3 });
        assert.ok(result.exposed.some(e => e.path === "/.env"));
    } finally {
        await new Promise(resolve => softServer.close(resolve));
    }
});
