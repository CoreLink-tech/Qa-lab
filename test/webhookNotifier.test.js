const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { buildWebhookPayload, sendWebhook, sendWebhooks } = require("../src/webhookNotifier");

function fakeReportData(overrides = {}) {
    return {
        url: "https://example.com",
        timestamp: "2026-01-01T00:00:00.000Z",
        score: { score: 80, grade: "B", severity: { critical: 0, high: 1, medium: 0, low: 0 } },
        summary: { pagesScanned: 5, issuesFound: 3 },
        ...overrides
    };
}

test("buildWebhookPayload includes core scan fields", () => {
    const payload = buildWebhookPayload(fakeReportData());
    assert.equal(payload.url, "https://example.com");
    assert.equal(payload.score, 80);
    assert.equal(payload.grade, "B");
    assert.equal(payload.pagesScanned, 5);
    assert.equal(payload.issuesFound, 3);
});

test("buildWebhookPayload includes qualityGate as null when no gate result is given", () => {
    const payload = buildWebhookPayload(fakeReportData());
    assert.equal(payload.qualityGate, null);
});

test("buildWebhookPayload includes the gate result when given", () => {
    const payload = buildWebhookPayload(fakeReportData(), { passed: false, reasons: ["score too low"] });
    assert.equal(payload.qualityGate.passed, false);
    assert.deepEqual(payload.qualityGate.reasons, ["score too low"]);
});

let server, baseUrl, receivedBodies;

test.before(async () => {
    receivedBodies = [];
    server = http.createServer((req, res) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            if (req.url === "/fail") {
                res.writeHead(500);
                res.end("server error");
                return;
            }
            receivedBodies.push(JSON.parse(body));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise(resolve => server.close(resolve));
});

test("sendWebhook successfully POSTs the payload as JSON", async () => {
    const result = await sendWebhook(baseUrl + "/ok", buildWebhookPayload(fakeReportData()));
    assert.equal(result.success, true);
    assert.equal(result.error, null);
    assert.equal(receivedBodies[receivedBodies.length - 1].url, "https://example.com");
});

test("sendWebhook returns success:false on failure instead of throwing", async () => {
    const result = await sendWebhook(baseUrl + "/fail", buildWebhookPayload(fakeReportData()));
    assert.equal(result.success, false);
    assert.ok(result.error);
});

test("sendWebhook returns success:false for a completely unreachable host, doesn't throw", async () => {
    await assert.doesNotReject(async () => {
        const result = await sendWebhook("http://127.0.0.1:1/nope", buildWebhookPayload(fakeReportData()));
        assert.equal(result.success, false);
    });
});

test("sendWebhooks sends to multiple URLs and reports per-target results", async () => {
    const results = await sendWebhooks([baseUrl + "/ok", baseUrl + "/fail"], fakeReportData());
    assert.equal(results.length, 2);
    assert.equal(results[0].success, true);
    assert.equal(results[1].success, false);
});
