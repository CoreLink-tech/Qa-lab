const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("../../src/rules/accessibilityRules");
const { makePage, makeModel } = require("../helpers/fixtures");

function ids(findings) {
    return findings.map(f => f.id);
}

test("flags images missing alt attributes", () => {
    const model = makeModel([makePage({ images: { total: 3, missingAlt: 2 } })]);
    const findings = rule.run(model);
    assert.equal(findings.filter(f => f.id === "ACC001").length, 1);
    assert.match(findings.find(f => f.id === "ACC001").details, /2 image\(s\)/);
});

test("does not flag pages where every image has alt text", () => {
    const model = makeModel([makePage({ images: { total: 3, missingAlt: 0 } })]);
    assert.ok(!ids(rule.run(model)).includes("ACC001"));
});

test("flags a skipped heading level (h2 straight to h4)", () => {
    const model = makeModel([makePage({ headingSequence: ["h1", "h2", "h4"] })]);
    const findings = rule.run(model);
    const finding = findings.find(f => f.id === "ACC002");
    assert.ok(finding);
    assert.match(finding.details, /h2 to h4/);
});

test("does not flag a properly nested heading sequence", () => {
    const model = makeModel([makePage({ headingSequence: ["h1", "h2", "h3", "h2", "h3"] })]);
    assert.ok(!ids(rule.run(model)).includes("ACC002"));
});

test("does not flag going back UP levels (h3 back to h2 is fine)", () => {
    const model = makeModel([makePage({ headingSequence: ["h1", "h2", "h3", "h4", "h2"] })]);
    assert.ok(!ids(rule.run(model)).includes("ACC002"));
});

test("flags an input with no label, no id, and no aria attributes", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "text", name: "search", id: null, ariaLabel: null, ariaLabelledby: null }] },
        labelFors: []
    })]);
    assert.ok(ids(rule.run(model)).includes("ACC003"));
});

test("does not flag an input matched to a <label for>", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "text", name: "search", id: "search-input", ariaLabel: null, ariaLabelledby: null }] },
        labelFors: ["search-input"]
    })]);
    assert.ok(!ids(rule.run(model)).includes("ACC003"));
});

test("does not flag an input with an aria-label, even with no matching <label>", () => {
    const model = makeModel([makePage({
        forms: { fields: [{ type: "text", name: "search", id: null, ariaLabel: "Search the site", ariaLabelledby: null }] },
        labelFors: []
    })]);
    assert.ok(!ids(rule.run(model)).includes("ACC003"));
});

test("does not flag non-labelable field types like hidden or submit", () => {
    const model = makeModel([makePage({
        forms: { fields: [
            { type: "hidden", name: "csrf", id: null, ariaLabel: null, ariaLabelledby: null },
            { type: "submit", name: null, id: null, ariaLabel: null, ariaLabelledby: null }
        ] },
        labelFors: []
    })]);
    assert.ok(!ids(rule.run(model)).includes("ACC003"));
});

test("flags a page with no lang attribute", () => {
    const model = makeModel([makePage({ lang: null })]);
    assert.ok(ids(rule.run(model)).includes("ACC004"));
});

test("does not flag a page with a lang attribute set", () => {
    const model = makeModel([makePage({ lang: "en" })]);
    assert.ok(!ids(rule.run(model)).includes("ACC004"));
});
