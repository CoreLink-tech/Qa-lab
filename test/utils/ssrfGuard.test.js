"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  assertSafeScanUrl,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
} = require("../../src/utils/ssrfGuard");

describe("ssrfGuard", () => {
  describe("isPrivateOrReservedIPv4", () => {
    it("blocks loopback and private ranges", () => {
      assert.equal(isPrivateOrReservedIPv4("127.0.0.1"), true);
      assert.equal(isPrivateOrReservedIPv4("10.0.0.5"), true);
      assert.equal(isPrivateOrReservedIPv4("192.168.1.1"), true);
      assert.equal(isPrivateOrReservedIPv4("172.16.0.1"), true);
      assert.equal(isPrivateOrReservedIPv4("169.254.169.254"), true);
    });

    it("allows public addresses", () => {
      assert.equal(isPrivateOrReservedIPv4("8.8.8.8"), false);
      assert.equal(isPrivateOrReservedIPv4("1.1.1.1"), false);
    });
  });

  describe("isPrivateOrReservedIPv6", () => {
    it("blocks loopback and ULA", () => {
      assert.equal(isPrivateOrReservedIPv6("::1"), true);
      assert.equal(isPrivateOrReservedIPv6("fc00::1"), true);
      assert.equal(isPrivateOrReservedIPv6("fe80::1"), true);
    });
  });

  describe("assertSafeScanUrl", () => {
    it("accepts a normal public HTTPS URL", async () => {
      const result = await assertSafeScanUrl("https://example.com/path");
      assert.equal(result.hostname, "example.com");
      assert.equal(result.protocol, "https:");
    });

    it("rejects non-http(s) schemes", async () => {
      await assert.rejects(
        () => assertSafeScanUrl("file:///etc/passwd"),
        /Disallowed URL scheme/
      );
      await assert.rejects(
        () => assertSafeScanUrl("ftp://example.com"),
        /Disallowed URL scheme/
      );
    });

    it("rejects localhost and metadata hostnames", async () => {
      await assert.rejects(
        () => assertSafeScanUrl("http://localhost/"),
        /Blocked hostname/
      );
      await assert.rejects(
        () => assertSafeScanUrl("http://metadata.google.internal/"),
        /Blocked hostname/
      );
    });

    it("rejects literal private IPs", async () => {
      await assert.rejects(
        () => assertSafeScanUrl("http://127.0.0.1/"),
        /Blocked private/
      );
      await assert.rejects(
        () => assertSafeScanUrl("http://192.168.0.1/"),
        /Blocked private/
      );
      await assert.rejects(
        () => assertSafeScanUrl("http://169.254.169.254/latest/meta-data/"),
        /Blocked private/
      );
    });

    it("rejects invalid URLs", async () => {
      await assert.rejects(
        () => assertSafeScanUrl("not-a-url"),
        /Invalid URL/
      );
    });
  });
});
