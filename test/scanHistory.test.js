const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    saveScanToHistory,
    loadScanHistory,
    getPreviousFullScan,
    sanitizeHost,
    historyDirFor
} = require("../src/scanHistory");

const historyRoot = path.join(__dirname, "../reports/history");

function cleanHistoryDir() {
    if (fs.existsSync(historyRoot)) {
        fs.rmSync(historyRoot, { recursive: true, force: true });
    }
}

test.beforeEach(cleanHistoryDir);
test.after(cleanHistoryDir);

function fakeReport(overrides = {}) {
    return {
        url: "https://example.com",
        timestamp: "2026-01-01T10:00:00.000Z",
        score: { score: 80, grade: "B" },
        summary: { pagesScanned: 5, issuesFound: 3 },
        findings: [],
        recommendations: [],
        ...overrides
    };
}

test("sanitizeHost strips characters unsafe for a directory name", () => {
    assert.equal(sanitizeHost("https://example.com/path"), "example.com");
    assert.equal(sanitizeHost("not a url"), "unknown-host");
});

test("saveScanToHistory writes a file and loadScanHistory reads it back", () => {
    saveScanToHistory(fakeReport());
    const history = loadScanHistory("https://example.com");
    assert.equal(history.length, 1);
    assert.equal(history[0].score, 80);
    assert.equal(history[0].grade, "B");
    assert.equal(history[0].pagesScanned, 5);
});

test("loadScanHistory returns an empty array for a site with no history", () => {
    assert.deepEqual(loadScanHistory("https://never-scanned.com"), []);
});

test("loadScanHistory sorts oldest to newest regardless of write order", () => {
    saveScanToHistory(fakeReport({ timestamp: "2026-01-03T00:00:00.000Z", score: { score: 90 } }));
    saveScanToHistory(fakeReport({ timestamp: "2026-01-01T00:00:00.000Z", score: { score: 70 } }));
    saveScanToHistory(fakeReport({ timestamp: "2026-01-02T00:00:00.000Z", score: { score: 80 } }));

    const history = loadScanHistory("https://example.com");
    assert.deepEqual(history.map(h => h.score), [70, 80, 90]);
});

test("different hosts get separate history, not mixed together", () => {
    saveScanToHistory(fakeReport({ url: "https://siteA.com", timestamp: "2026-01-01T00:00:00.000Z" }));
    saveScanToHistory(fakeReport({ url: "https://siteB.com", timestamp: "2026-01-01T00:00:00.000Z" }));

    assert.equal(loadScanHistory("https://siteA.com").length, 1);
    assert.equal(loadScanHistory("https://siteB.com").length, 1);
});

test("getPreviousFullScan returns null when there's no prior scan", () => {
    saveScanToHistory(fakeReport({ timestamp: "2026-01-01T00:00:00.000Z" }));
    const previous = getPreviousFullScan("https://example.com", "2026-01-01T00:00:00.000Z");
    assert.equal(previous, null);
});

test("getPreviousFullScan returns the full report data of the most recent prior scan", () => {
    saveScanToHistory(fakeReport({
        timestamp: "2026-01-01T00:00:00.000Z",
        findings: [{ id: "X1", title: "Old issue" }]
    }));
    saveScanToHistory(fakeReport({ timestamp: "2026-01-02T00:00:00.000Z" }));

    const previous = getPreviousFullScan("https://example.com", "2026-01-02T00:00:00.000Z");
    assert.equal(previous.timestamp, "2026-01-01T00:00:00.000Z");
    assert.equal(previous.findings.length, 1);
    assert.equal(previous.findings[0].title, "Old issue");
});

test("a corrupted history file is skipped rather than crashing loadScanHistory", () => {
    const dir = historyDirFor("https://example.com");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "corrupt.json"), "{ not valid json");
    saveScanToHistory(fakeReport());

    assert.doesNotThrow(() => loadScanHistory("https://example.com"));
    assert.equal(loadScanHistory("https://example.com").length, 1);
});
