const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/securityRules");
const { makePage, makeModel } = require("../helpers/fixtures");

function ids(findings) {
    return findings.map(f => f.id);
}

const goodHeaders = {
    "content-security-policy": "default-src 'self'",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=63072000",
    "x-content-type-options": "nosniff"
};

test("flags all 4 missing security headers", () => {
    const model = makeModel([makePage({ headers: {} })]);
    const found = ids(rule.run(model));
    assert.ok(found.includes("SEC001"));
    assert.ok(found.includes("SEC002"));
    assert.ok(found.includes("SEC003"));
    assert.ok(found.includes("SEC004"));
});

test("no header findings when all 4 headers are present and clean", () => {
    const model = makeModel([makePage({ headers: goodHeaders })]);
    const found = ids(rule.run(model));
    assert.ok(!found.includes("SEC001"));
    assert.ok(!found.includes("SEC002"));
    assert.ok(!found.includes("SEC003"));
    assert.ok(!found.includes("SEC004"));
});

test("a page with no headers object at all is skipped, not thrown", () => {
    const model = makeModel([makePage({ headers: undefined, url: "https://example.com/" })]);
    assert.doesNotThrow(() => rule.run(model));
});

test("flags HTTP (non-HTTPS) pages", () => {
    const model = makeModel([makePage({ url: "http://example.com/", headers: goodHeaders })]);
    assert.ok(ids(rule.run(model)).includes("SEC005"));
});

test("does not flag HTTPS pages for missing HTTPS enforcement", () => {
    const model = makeModel([makePage({ url: "https://example.com/", headers: goodHeaders })]);
    assert.ok(!ids(rule.run(model)).includes("SEC005"));
});

test("flags a CSP containing unsafe-inline", () => {
    const model = makeModel([makePage({
        headers: { ...goodHeaders, "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'" }
    })]);
    assert.ok(ids(rule.run(model)).includes("SEC006"));
});

test("flags a CSP containing a wildcard source", () => {
    const model = makeModel([makePage({
        headers: { ...goodHeaders, "content-security-policy": "default-src *" }
    })]);
    assert.ok(ids(rule.run(model)).includes("SEC006"));
});

test("does not flag a strict CSP", () => {
    const model = makeModel([makePage({
        headers: { ...goodHeaders, "content-security-policy": "default-src 'self'" }
    })]);
    assert.ok(!ids(rule.run(model)).includes("SEC006"));
});

test("flags a Server header that discloses a version number", () => {
    const model = makeModel([makePage({ headers: { ...goodHeaders, server: "Apache/2.4.41 (Ubuntu)" } })]);
    assert.ok(ids(rule.run(model)).includes("SEC007"));
});

test("does not flag a generic Server header with no version", () => {
    const model = makeModel([makePage({ headers: { ...goodHeaders, server: "cloudflare" } })]);
    assert.ok(!ids(rule.run(model)).includes("SEC007"));
});

test("flags a cookie missing Secure and HttpOnly flags", () => {
    const model = makeModel([makePage({
        headers: goodHeaders,
        cookies: [{ name: "sessionid", secure: false, httpOnly: false, sameSite: null }]
    })]);
    const finding = rule.run(model).find(f => f.id === "SEC008");
    assert.ok(finding);
    assert.match(finding.details, /1 cookie\(s\) missing Secure/);
});

test("does not flag a properly secured cookie", () => {
    const model = makeModel([makePage({
        headers: goodHeaders,
        cookies: [{ name: "sessionid", secure: true, httpOnly: true, sameSite: "Strict" }]
    })]);
    assert.ok(!ids(rule.run(model)).includes("SEC008"));
});

test("handles multiple cookies, flagging only the ones missing flags", () => {
    const model = makeModel([makePage({
        headers: goodHeaders,
        cookies: [
            { name: "good", secure: true, httpOnly: true, sameSite: null },
            { name: "bad", secure: false, httpOnly: false, sameSite: null }
        ]
    })]);
    const finding = rule.run(model).find(f => f.id === "SEC008");
    assert.ok(finding);
    assert.match(finding.details, /1 cookie\(s\) missing Secure, 1 missing HttpOnly/);
});

test("flags mixed content on an HTTPS page", () => {
    const model = makeModel([makePage({ headers: goodHeaders, mixedContentCount: 2 })]);
    const finding = rule.run(model).find(f => f.id === "SEC009");
    assert.ok(finding);
    assert.match(finding.details, /2 resource/);
});

test("does not flag mixed content when count is zero", () => {
    const model = makeModel([makePage({ headers: goodHeaders, mixedContentCount: 0 })]);
    assert.ok(!ids(rule.run(model)).includes("SEC009"));
});
