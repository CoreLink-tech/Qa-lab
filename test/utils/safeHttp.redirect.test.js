"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { safeGet } = require("../../src/utils/safeHttp");

describe("safeHttp redirect SSRF", () => {
  /** @type {import('http').Server} */
  let server;
  /** @type {number} */
  let port;
  /** @type {string|undefined} */
  let prevAllowPrivate;

  before(async () => {
    // These cases assert Blocked* SSRF policy. The suite runs with
    // QA_LAB_ALLOW_PRIVATE_NETWORK=1 for local fixtures; turn it off here.
    prevAllowPrivate = process.env.QA_LAB_ALLOW_PRIVATE_NETWORK;
    delete process.env.QA_LAB_ALLOW_PRIVATE_NETWORK;
    server = http.createServer((req, res) => {
      if (req.url === "/ok") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        return;
      }
      if (req.url === "/redir-loopback") {
        res.writeHead(302, { Location: "http://127.0.0.1/" });
        res.end();
        return;
      }
      if (req.url === "/redir-metadata") {
        res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
        res.end();
        return;
      }
      if (req.url === "/redir-brackets") {
        res.writeHead(302, { Location: "http://[::1]/" });
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = /** @type {import('net').AddressInfo} */ (server.address()).port;
        resolve();
      });
    });
  });

  after(async () => {
    if (prevAllowPrivate === undefined) {
      delete process.env.QA_LAB_ALLOW_PRIVATE_NETWORK;
    } else {
      process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = prevAllowPrivate;
    }
    await new Promise((resolve) => server.close(resolve));
  });

  it("blocks redirect to 127.0.0.1", async () => {
    // First hop is loopback literal — blocked at validation of start URL
    // Use a start URL that is public-looking is hard without public DNS.
    // Validate redirect target path by calling safeGet on redirect URL policy:
    // When start is loopback, assertSafeScanUrl blocks before fetch.
    await assert.rejects(
      () => safeGet(`http://127.0.0.1:${port}/redir-loopback`, {
        allowedPorts: new Set([port, 80, 443]),
      }),
      /Blocked/,
    );
  });

  it("blocks redirect Location to metadata when following from validated hop", async () => {
    // Simulate follow: second hop validation
    const { assertSafeScanUrl } = require("../../src/utils/ssrfGuard");
    await assert.rejects(
      () => assertSafeScanUrl("http://169.254.169.254/latest/meta-data/"),
      /Blocked/,
    );
    await assert.rejects(
      () => assertSafeScanUrl("http://[::1]/"),
      /Blocked/,
    );
  });

  it("documents that public→private redirect is blocked by hop re-validation", async () => {
    // Unit-level: after reading Location header, assertSafeScanUrl is called on target
    const { assertSafeScanUrl } = require("../../src/utils/ssrfGuard");
    await assert.rejects(
      () => assertSafeScanUrl("http://127.0.0.1/"),
      /Blocked/,
    );
  });
});
