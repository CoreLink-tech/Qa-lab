const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/exposedPathsRules");
const { makePage, makeModel } = require("../helpers/fixtures");

function ids(findings) {
    return findings.map(f => f.id);
}

test("returns no findings when exposedPathChecks is absent (default, no --check-exposed-paths)", () => {
    const model = makeModel([makePage()]);
    assert.deepEqual(rule.run(model), []);
});

test("flags an exposed sensitive file as SEC011/Critical", () => {
    const model = makeModel([makePage()]);
    model.exposedPathChecks = {
        exposed: [{ path: "/.env", category: "sensitive-file", label: ".env file", status: 200 }],
        hasSecurityTxt: true
    };
    const finding = rule.run(model).find(f => f.id === "SEC011");
    assert.ok(finding);
    assert.equal(finding.severity, "Critical");
    assert.match(finding.page, /\/\.env$/);
});

test("flags a directory listing as SEC012/Medium", () => {
    const model = makeModel([makePage()]);
    model.exposedPathChecks = {
        exposed: [{ path: "/uploads/", category: "directory-listing", label: "Directory listing enabled (/uploads/)", status: 200 }],
        hasSecurityTxt: true
    };
    const finding = rule.run(model).find(f => f.id === "SEC012");
    assert.ok(finding);
    assert.equal(finding.severity, "Medium");
});

test("flags a discoverable admin panel as SEC013/Info (not a vulnerability by itself)", () => {
    const model = makeModel([makePage()]);
    model.exposedPathChecks = {
        exposed: [{ path: "/admin", category: "recon", label: "Admin panel at a default path", status: 200 }],
        hasSecurityTxt: true
    };
    const finding = rule.run(model).find(f => f.id === "SEC013");
    assert.ok(finding);
    assert.equal(finding.severity, "Info");
});

test("flags missing security.txt as SEC014/Info", () => {
    const model = makeModel([makePage()]);
    model.exposedPathChecks = { exposed: [], hasSecurityTxt: false };
    assert.ok(ids(rule.run(model)).includes("SEC014"));
});

test("does not flag SEC014 when security.txt is present", () => {
    const model = makeModel([makePage()]);
    model.exposedPathChecks = { exposed: [], hasSecurityTxt: true };
    assert.ok(!ids(rule.run(model)).includes("SEC014"));
});

test("produces no findings when nothing was exposed and security.txt exists", () => {
    const model = makeModel([makePage()]);
    model.exposedPathChecks = { exposed: [], hasSecurityTxt: true };
    assert.deepEqual(rule.run(model), []);
});

test("builds the finding page URL relative to the site's root", () => {
    const model = makeModel([makePage()]);
    model.url = "https://shop.example.com";
    model.exposedPathChecks = {
        exposed: [{ path: "/.git/HEAD", category: "sensitive-file", label: ".git repository", status: 200 }],
        hasSecurityTxt: true
    };
    const finding = rule.run(model).find(f => f.id === "SEC011");
    assert.equal(finding.page, "https://shop.example.com/.git/HEAD");
});

test("handles multiple exposed items across categories in one run", () => {
    const model = makeModel([makePage()]);
    model.exposedPathChecks = {
        exposed: [
            { path: "/.env", category: "sensitive-file", label: ".env file", status: 200 },
            { path: "/backup/", category: "directory-listing", label: "Directory listing enabled (/backup/)", status: 200 },
            { path: "/wp-admin/", category: "recon", label: "WordPress admin panel at a default path", status: 200 }
        ],
        hasSecurityTxt: false
    };
    const found = ids(rule.run(model));
    assert.ok(found.includes("SEC011"));
    assert.ok(found.includes("SEC012"));
    assert.ok(found.includes("SEC013"));
    assert.ok(found.includes("SEC014"));
});
