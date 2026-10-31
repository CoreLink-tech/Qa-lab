"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { scan } = require("../../src/lib/scan");

describe("scan AbortSignal", () => {
  it("stops with status cancelled when signal is aborted before work finishes", async () => {
    process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = "1";

    const server = http.createServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><head><title>t</title></head><body><a href='/b'>b</a></body></html>",
        );
      }, 250);
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const { port } = /** @type {import('net').AddressInfo} */ (server.address());
    const startUrl = `http://127.0.0.1:${port}/`;

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 40);

    const result = await scan({
      startUrl,
      maxPages: 20,
      maxDepth: 2,
      concurrency: 2,
      respectRobotsTxt: false,
      writeReports: false,
      signal: controller.signal,
    });

    await new Promise((r) => server.close(r));

    assert.equal(result.status, "cancelled");
    assert.ok(result.error);
  });
});
