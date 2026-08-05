const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/performanceRules");
const { makePage, makeModel } = require("../helpers/fixtures");

function ids(findings) {
    return findings.map(f => f.id);
}

test("flags very slow pages (>5000ms) as High severity", () => {
    const model = makeModel([makePage({ responseTime: 6000, htmlSize: 500, headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" } })]);
    const findings = rule.run(model);
    const finding = findings.find(f => f.id === "PERF001");
    assert.ok(finding);
    assert.equal(finding.severity, "High");
});

test("flags moderately slow pages (2000-5000ms) as Medium severity", () => {
    const model = makeModel([makePage({ responseTime: 3000, htmlSize: 500, headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" } })]);
    const finding = rule.run(model).find(f => f.id === "PERF002");
    assert.ok(finding);
    assert.equal(finding.severity, "Medium");
});

test("fast pages (<2000ms) produce no response-time findings", () => {
    const model = makeModel([makePage({ responseTime: 500, htmlSize: 500, headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" } })]);
    const found = ids(rule.run(model));
    assert.ok(!found.includes("PERF001"));
    assert.ok(!found.includes("PERF002"));
});

test("a page with no numeric responseTime is skipped, not thrown", () => {
    const model = makeModel([makePage({ responseTime: null, htmlSize: 500, headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" } })]);
    assert.doesNotThrow(() => rule.run(model));
});

test("flags a large uncompressed page as missing compression", () => {
    const model = makeModel([makePage({ htmlSize: 50000, headers: { "cache-control": "max-age=3600" } })]);
    assert.ok(ids(rule.run(model)).includes("PERF003"));
});

test("does not flag a small page for missing compression", () => {
    const model = makeModel([makePage({ htmlSize: 200, headers: { "cache-control": "max-age=3600" } })]);
    assert.ok(!ids(rule.run(model)).includes("PERF003"));
});

test("does not flag compression when content-encoding is present", () => {
    const model = makeModel([makePage({ htmlSize: 50000, headers: { "content-encoding": "br", "cache-control": "max-age=3600" } })]);
    assert.ok(!ids(rule.run(model)).includes("PERF003"));
});

test("flags a missing Cache-Control header", () => {
    const model = makeModel([makePage({ htmlSize: 200, headers: { "content-encoding": "gzip" } })]);
    assert.ok(ids(rule.run(model)).includes("PERF004"));
});

test("does not flag caching when Cache-Control is present", () => {
    const model = makeModel([makePage({ htmlSize: 200, headers: { "content-encoding": "gzip", "cache-control": "no-cache" } })]);
    assert.ok(!ids(rule.run(model)).includes("PERF004"));
});

test("flags an oversized HTML payload", () => {
    const model = makeModel([makePage({ htmlSize: 600 * 1024, headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" } })]);
    const finding = rule.run(model).find(f => f.id === "PERF005");
    assert.ok(finding);
    assert.match(finding.details, /600 KB|599 KB/);
});

test("does not flag a normally sized page for weight", () => {
    const model = makeModel([makePage({ htmlSize: 50000, headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" } })]);
    assert.ok(!ids(rule.run(model)).includes("PERF005"));
});

test("flags a render-blocking script in head with no async/defer", () => {
    const model = makeModel([makePage({
        htmlSize: 200,
        headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" },
        scripts: [{ src: "/app.js", inline: false, location: "head", async: false, defer: false }]
    })]);
    const finding = require("../../src/rules/performanceRules").run(model).find(f => f.id === "PERF006");
    assert.ok(finding);
    assert.match(finding.details, /\/app\.js/);
});

test("does not flag a head script that has defer set", () => {
    const model = makeModel([makePage({
        htmlSize: 200,
        headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" },
        scripts: [{ src: "/app.js", inline: false, location: "head", async: false, defer: true }]
    })]);
    const findings = require("../../src/rules/performanceRules").run(model);
    assert.ok(!findings.map(f => f.id).includes("PERF006"));
});

test("does not flag a body script even without async/defer", () => {
    const model = makeModel([makePage({
        htmlSize: 200,
        headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" },
        scripts: [{ src: "/app.js", inline: false, location: "body", async: false, defer: false }]
    })]);
    const findings = require("../../src/rules/performanceRules").run(model);
    assert.ok(!findings.map(f => f.id).includes("PERF006"));
});

test("does not flag an inline head script (no src to defer)", () => {
    const model = makeModel([makePage({
        htmlSize: 200,
        headers: { "content-encoding": "gzip", "cache-control": "max-age=3600" },
        scripts: [{ src: null, inline: true, location: "head", async: false, defer: false }]
    })]);
    const findings = require("../../src/rules/performanceRules").run(model);
    assert.ok(!findings.map(f => f.id).includes("PERF006"));
});
