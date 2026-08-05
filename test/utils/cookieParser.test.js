const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCookies } = require("../../src/utils/cookieParser");

test("returns an empty array when there is no Set-Cookie header", () => {
    assert.deepEqual(parseCookies(undefined), []);
});

test("parses a single cookie string with no flags", () => {
    const result = parseCookies("sessionid=abc123; Path=/");
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "sessionid");
    assert.equal(result[0].secure, false);
    assert.equal(result[0].httpOnly, false);
    assert.equal(result[0].sameSite, null);
});

test("detects Secure, HttpOnly, and SameSite flags", () => {
    const result = parseCookies("sessionid=abc123; Path=/; Secure; HttpOnly; SameSite=Strict");
    assert.equal(result[0].secure, true);
    assert.equal(result[0].httpOnly, true);
    assert.equal(result[0].sameSite, "Strict");
});

test("handles multiple Set-Cookie values as an array", () => {
    const result = parseCookies(["a=1; Secure", "b=2; HttpOnly"]);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "a");
    assert.equal(result[1].name, "b");
});

test("flag matching is case-insensitive", () => {
    const result = parseCookies("a=1; secure; httponly");
    assert.equal(result[0].secure, true);
    assert.equal(result[0].httpOnly, true);
});
