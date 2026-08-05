const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { parseRobotsTxt, isAllowed, fetchRobotsRules } = require("../src/robotsTxt");

test("parses Disallow rules under a wildcard user-agent block", () => {
    const rules = parseRobotsTxt("User-agent: *\nDisallow: /admin\nDisallow: /private");
    assert.deepEqual(rules.disallowed, ["/admin", "/private"]);
});

test("ignores Disallow rules under a non-wildcard user-agent block", () => {
    const rules = parseRobotsTxt("User-agent: Googlebot\nDisallow: /google-only");
    assert.deepEqual(rules.disallowed, []);
});

test("handles an empty robots.txt", () => {
    assert.deepEqual(parseRobotsTxt(""), { disallowed: [] });
});

test("isAllowed returns true when nothing is disallowed", () => {
    assert.equal(isAllowed({ disallowed: [] }, "/anything"), true);
});

test("isAllowed matches by prefix", () => {
    const rules = { disallowed: ["/admin"] };
    assert.equal(isAllowed(rules, "/admin/users"), false);
    assert.equal(isAllowed(rules, "/about"), true);
});

test("isAllowed handles a null rules object as allow-everything", () => {
    assert.equal(isAllowed(null, "/anything"), true);
});

test("fetchRobotsRules against a real server that serves robots.txt", async () => {
    const server = http.createServer((req, res) => {
        if (req.url === "/robots.txt") {
            res.writeHead(200);
            res.end("User-agent: *\nDisallow: /secret");
            return;
        }
        res.writeHead(404);
        res.end();
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    const rules = await fetchRobotsRules(`http://127.0.0.1:${port}/`);
    assert.deepEqual(rules.disallowed, ["/secret"]);

    await new Promise(resolve => server.close(resolve));
});

test("fetchRobotsRules against a server with no robots.txt allows everything", async () => {
    const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    const rules = await fetchRobotsRules(`http://127.0.0.1:${port}/`);
    assert.deepEqual(rules.disallowed, []);

    await new Promise(resolve => server.close(resolve));
});
