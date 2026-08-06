const test = require("node:test");
const assert = require("node:assert/strict");
const { printSummary, printHistory, printComparison } = require("../src/terminalReport");

function captureConsole(fn) {
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(" "));
    try {
        fn();
    } finally {
        console.log = original;
    }
    return lines.join("\n");
}

test("printSummary only lists formats that were actually generated", () => {
    const model = {
        url: "https://example.com",
        score: { score: 90, grade: "A" },
        pages: [{ url: "https://example.com/" }],
        findings: []
    };
    const output = captureConsole(() => printSummary(model, ["csv"]));
    assert.ok(output.includes("report.csv"));
    assert.ok(!output.includes("report.json"));
    assert.ok(!output.includes("report.html"));
});

test("printSummary omits the Reports section entirely when no formats given", () => {
    const model = {
        url: "https://example.com",
        score: { score: 90, grade: "A" },
        pages: [{ url: "https://example.com/" }],
        findings: []
    };
    const output = captureConsole(() => printSummary(model, []));
    assert.ok(!output.includes("Reports"));
});

test("printHistory shows a message when there's no history", () => {
    const output = captureConsole(() => printHistory([], "https://example.com"));
    assert.match(output, /No prior scans found/);
});

test("printHistory lists each scan's score, grade, pages, and issues", () => {
    const history = [
        { timestamp: "2026-01-01T00:00:00.000Z", score: 70, grade: "C", pagesScanned: 5, issuesFound: 10 },
        { timestamp: "2026-01-02T00:00:00.000Z", score: 85, grade: "B", pagesScanned: 5, issuesFound: 4 }
    ];
    const output = captureConsole(() => printHistory(history, "https://example.com"));
    assert.match(output, /70/);
    assert.match(output, /85/);
});

test("printComparison handles a null (no-previous-scan) comparison gracefully", () => {
    const output = captureConsole(() => printComparison({
        previousTimestamp: null, currentTimestamp: "x", previousScore: null,
        currentScore: 90, scoreDelta: null, newIssues: [], resolvedIssues: []
    }));
    assert.match(output, /No previous scan found/);
});

test("printComparison shows score delta and new/resolved issue counts", () => {
    const output = captureConsole(() => printComparison({
        previousTimestamp: "2026-01-01T00:00:00.000Z",
        currentTimestamp: "2026-01-02T00:00:00.000Z",
        previousScore: 70,
        currentScore: 85,
        scoreDelta: 15,
        newIssues: [],
        resolvedIssues: [{ severity: "Low", title: "Missing H1", page: "https://example.com/" }]
    }));
    assert.match(output, /\+15/);
    assert.match(output, /Resolved Issues \(1\)/);
    assert.match(output, /Missing H1/);
});
