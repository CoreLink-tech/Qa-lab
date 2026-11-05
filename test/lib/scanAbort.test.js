"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { scan } = require("../../src/lib/scan");

describe("scan AbortSignal", () => {
  it("returns cancelled when signal is already aborted", async () => {
    process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = "1";

    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><head><title>t</title></head><body>ok</body></html>");
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const { port } = /** @type {import('net').AddressInfo} */ (server.address());
    const startUrl = `http://127.0.0.1:${port}/`;

    const controller = new AbortController();
    controller.abort();

    const result = await scan({
      startUrl,
      maxPages: 5,
      maxDepth: 1,
      concurrency: 1,
      respectRobotsTxt: false,
      writeReports: false,
      signal: controller.signal,
    });

    await new Promise((r) => server.close(r));

    assert.equal(result.status, "cancelled");
    assert.match(String(result.error || ""), /cancel/i);
  });
});
