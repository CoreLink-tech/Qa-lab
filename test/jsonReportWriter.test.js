const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createJsonReportWriter } = require("../src/jsonReportWriter");

function tempFile() {
    return path.join(os.tmpdir(), `qa-lab-json-writer-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test("produces valid, parseable JSON with pages and metadata", async () => {
    const filePath = tempFile();
    const writer = createJsonReportWriter(filePath, {
        schemaVersion: "1.0",
        url: "https://example.com",
        timestamp: "2026-01-01T00:00:00.000Z"
    });

    writer.writePage({ url: "https://example.com/", status: 200 });
    writer.writePage({ url: "https://example.com/a", status: 200 });
    await writer.finalize({
        score: { score: 90, grade: "A" },
        summary: { pagesScanned: 2 },
        findings: [{ id: "X" }],
        recommendations: [{ issue: "X" }]
    });

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(parsed.schemaVersion, "1.0");
    assert.equal(parsed.url, "https://example.com");
    assert.equal(parsed.pages.length, 2);
    assert.equal(parsed.pages[0].url, "https://example.com/");
    assert.equal(parsed.score.score, 90);
    assert.equal(parsed.summary.pagesScanned, 2);
    assert.equal(parsed.findings.length, 1);
    assert.equal(parsed.recommendations.length, 1);

    fs.unlinkSync(filePath);
});

test("excludes raw html from each written page, keeps every other field", async () => {
    const filePath = tempFile();
    const writer = createJsonReportWriter(filePath, {
        schemaVersion: "1.0", url: "https://example.com", timestamp: "now"
    });

    writer.writePage({
        url: "https://example.com/",
        html: "<html>huge blob</html>",
        someBrandNewField: "should still appear"
    });
    await writer.finalize({ score: {}, summary: {}, findings: [], recommendations: [] });

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(parsed.pages[0].html, undefined);
    assert.equal(parsed.pages[0].someBrandNewField, "should still appear");

    fs.unlinkSync(filePath);
});

test("produces valid JSON with zero pages", async () => {
    const filePath = tempFile();
    const writer = createJsonReportWriter(filePath, {
        schemaVersion: "1.0", url: "https://example.com", timestamp: "now"
    });
    await writer.finalize({ score: {}, summary: {}, findings: [], recommendations: [] });

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.deepEqual(parsed.pages, []);

    fs.unlinkSync(filePath);
});

test("pageCount tracks how many pages have been written", async () => {
    const filePath = tempFile();
    const writer = createJsonReportWriter(filePath, {
        schemaVersion: "1.0", url: "https://example.com", timestamp: "now"
    });
    assert.equal(writer.pageCount, 0);
    writer.writePage({ url: "https://example.com/a" });
    writer.writePage({ url: "https://example.com/b" });
    assert.equal(writer.pageCount, 2);
    await writer.finalize({ score: {}, summary: {}, findings: [], recommendations: [] });

    fs.unlinkSync(filePath);
});

test("throws if writePage is called after finalize", async () => {
    const filePath = tempFile();
    const writer = createJsonReportWriter(filePath, {
        schemaVersion: "1.0", url: "https://example.com", timestamp: "now"
    });
    await writer.finalize({ score: {}, summary: {}, findings: [], recommendations: [] });
    assert.throws(() => writer.writePage({ url: "https://example.com/late" }));

    fs.unlinkSync(filePath);
});
