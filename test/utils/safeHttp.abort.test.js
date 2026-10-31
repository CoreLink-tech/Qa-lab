"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { safeGet } = require("../../src/utils/safeHttp");

describe("safeHttp AbortSignal", () => {
  it("rejects with AbortError when signal is already aborted", async () => {
    process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = "1";

    const server = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("slow");
      }, 500);
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const { port } = /** @type {import('net').AddressInfo} */ (server.address());

    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      () =>
        safeGet(`http://127.0.0.1:${port}/`, {
          allowedPorts: new Set([port, 80, 443]),
          signal: controller.signal,
        }),
      (err) => err && (err.name === "AbortError" || /cancel|aborted/i.test(String(err.message))),
    );

    await new Promise((r) => server.close(r));
  });
});
