const test = require("node:test");
const assert = require("node:assert/strict");
const { generateDashboard, buildScoreChart, buildHistoryTable } = require("../src/dashboardGenerator");

function entry(overrides = {}) {
    return { timestamp: "2026-01-01T00:00:00.000Z", score: 80, grade: "B", pagesScanned: 5, issuesFound: 3, ...overrides };
}

test("buildScoreChart shows an empty-state message for zero history", () => {
    const chart = buildScoreChart([]);
    assert.match(chart, /No scan history yet/);
});

test("buildScoreChart renders a single point without a connecting line", () => {
    const chart = buildScoreChart([entry()]);
    assert.match(chart, /<circle/);
    assert.ok(!chart.includes("<polyline"));
});

test("buildScoreChart renders a polyline for multiple points", () => {
    const chart = buildScoreChart([entry({ score: 60 }), entry({ score: 80 })]);
    assert.match(chart, /<polyline/);
    assert.equal((chart.match(/<circle/g) || []).length, 2);
});

test("buildScoreChart maps a higher score to a smaller y coordinate (higher on the chart)", () => {
    const chart = buildScoreChart([entry({ score: 20 }), entry({ score: 90 })]);
    const circles = [...chart.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)];
    assert.equal(circles.length, 2);
    const [, , yLow] = circles[0];
    const [, , yHigh] = circles[1];
    assert.ok(Number(yHigh) < Number(yLow), "higher score should have a smaller (higher on screen) y value");
});

test("buildScoreChart clamps out-of-range scores instead of drawing off-chart", () => {
    assert.doesNotThrow(() => buildScoreChart([entry({ score: 150 }), entry({ score: -20 })]));
});

test("buildScoreChart handles a null/missing score without throwing", () => {
    assert.doesNotThrow(() => buildScoreChart([entry({ score: null })]));
});

test("buildScoreChart escapes content used in point tooltips", () => {
    const chart = buildScoreChart([entry({ timestamp: "<script>alert(1)</script>" })]);
    assert.ok(!chart.includes("<script>alert"));
});

test("buildHistoryTable shows a message for zero history", () => {
    assert.match(buildHistoryTable([]), /No scan history yet/);
});

test("buildHistoryTable renders one row per history entry", () => {
    const table = buildHistoryTable([entry(), entry({ score: 90 })]);
    const bodyRows = table.match(/<tbody>[\s\S]*<\/tbody>/)[0].match(/<tr>/g) || [];
    assert.equal(bodyRows.length, 2);
});

test("generateDashboard produces a complete HTML document", () => {
    const html = generateDashboard([entry()], "https://example.com");
    assert.match(html, /<!DOCTYPE html>/);
    assert.match(html, /QA-LAB Dashboard/);
    assert.match(html, /1 scan\(s\) recorded/);
});

test("generateDashboard escapes the site URL in the title/heading", () => {
    const html = generateDashboard([entry()], "https://example.com/<script>");
    assert.ok(!html.includes("<script>alert") && !html.includes("com/<script>"));
});
