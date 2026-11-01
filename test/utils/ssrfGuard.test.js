"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const dns = require("dns");
const {
  assertSafeScanUrl,
  isBlockedIp,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  stripIpv6Brackets,
} = require("../../src/utils/ssrfGuard");

describe("ssrfGuard", () => {
  // Ensure attack-matrix tests are not weakened by the test-runner env flag
  process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = "";

  describe("stripIpv6Brackets", () => {
    it("strips brackets", () => {
      assert.equal(stripIpv6Brackets("[::1]"), "::1");
      assert.equal(stripIpv6Brackets("example.com"), "example.com");
    });
  });

  describe("isBlockedIp / private ranges", () => {
    it("blocks loopback and private IPv4", () => {
      assert.equal(isBlockedIp("127.0.0.1"), true);
      assert.equal(isBlockedIp("10.0.0.5"), true);
      assert.equal(isBlockedIp("192.168.1.1"), true);
      assert.equal(isBlockedIp("172.16.0.1"), true);
      assert.equal(isBlockedIp("169.254.169.254"), true);
      assert.equal(isBlockedIp("100.64.1.1"), true);
      assert.equal(isBlockedIp("198.18.0.1"), true);
      assert.equal(isBlockedIp("0.0.0.0"), true);
      assert.equal(isPrivateOrReservedIPv4("127.0.0.1"), true);
    });

    it("allows public IPv4", () => {
      assert.equal(isBlockedIp("8.8.8.8"), false);
      assert.equal(isBlockedIp("1.1.1.1"), false);
    });

    it("blocks IPv6 loopback ULA link-local and NAT64 to private", () => {
      assert.equal(isBlockedIp("::1"), true);
      assert.equal(isBlockedIp("fc00::1"), true);
      assert.equal(isBlockedIp("fe80::1"), true);
      assert.equal(isPrivateOrReservedIPv6("::1"), true);
      // IPv4-mapped loopback
      assert.equal(isBlockedIp("::ffff:127.0.0.1"), true);
      assert.equal(isBlockedIp("::ffff:169.254.169.254"), true);
    });
  });

  describe("assertSafeScanUrl attack matrix", () => {
    it("accepts a normal public HTTPS URL", async () => {
      const original = dns.promises.lookup;
      dns.promises.lookup = async () => [{ address: "93.184.216.34", family: 4 }];
      try {
        const result = await assertSafeScanUrl("https://example.com/path");
        assert.equal(result.hostname, "example.com");
        assert.equal(result.protocol, "https:");
        assert.ok(result.resolvedAddresses.length >= 1);
        assert.equal(result.resolvedAddresses[0], "93.184.216.34");
      } finally {
        dns.promises.lookup = original;
      }
    });

    it("rejects non-http(s) schemes", async () => {
      await assert.rejects(() => assertSafeScanUrl("file:///etc/passwd"), /scheme/i);
      await assert.rejects(() => assertSafeScanUrl("ftp://example.com"), /scheme/i);
    });

    it("rejects credentials in URL", async () => {
      await assert.rejects(
        () => assertSafeScanUrl("https://user:pass@example.com/"),
        /credentials/i,
      );
    });

    it("rejects localhost and metadata hostnames", async () => {
      await assert.rejects(() => assertSafeScanUrl("http://localhost/"), /Blocked hostname/);
      await assert.rejects(
        () => assertSafeScanUrl("http://metadata.google.internal/"),
        /Blocked hostname/,
      );
    });

    it("rejects literal private IPv4", async () => {
      await assert.rejects(() => assertSafeScanUrl("http://127.0.0.1/"), /Blocked/);
      await assert.rejects(() => assertSafeScanUrl("http://192.168.0.1/"), /Blocked/);
      await assert.rejects(
        () => assertSafeScanUrl("http://169.254.169.254/latest/meta-data/"),
        /Blocked/,
      );
      await assert.rejects(() => assertSafeScanUrl("http://198.18.0.1/"), /Blocked/);
    });

    it("rejects bracketed IPv6 loopback and mapped forms", async () => {
      await assert.rejects(() => assertSafeScanUrl("http://[::1]/"), /Blocked/);
      await assert.rejects(
        () => assertSafeScanUrl("http://[::ffff:127.0.0.1]/"),
        /Blocked/,
      );
      await assert.rejects(
        () => assertSafeScanUrl("http://[::ffff:169.254.169.254]/"),
        /Blocked/,
      );
    });

    it("rejects disallowed ports", async () => {
      await assert.rejects(
        () => assertSafeScanUrl("https://example.com:22/"),
        /Port 22/,
      );
    });

    it("rejects invalid URLs", async () => {
      await assert.rejects(() => assertSafeScanUrl("not a url"), /Invalid URL/);
    });

    it("rejects hostname that resolves only to private IP (mocked DNS)", async () => {
      const original = dns.promises.lookup;
      dns.promises.lookup = async () => [{ address: "127.0.0.1", family: 4 }];
      try {
        await assert.rejects(
          () => assertSafeScanUrl("http://evil.example/"),
          /resolves to blocked address 127.0.0.1/,
        );
      } finally {
        dns.promises.lookup = original;
      }
    });

    it("rejects when resolveDns true and DNS fails", async () => {
      const original = dns.promises.lookup;
      dns.promises.lookup = async () => {
        throw new Error("ENOTFOUND");
      };
      try {
        await assert.rejects(
          () => assertSafeScanUrl("http://no-such-host.invalid/"),
          /Unable to resolve/,
        );
      } finally {
        dns.promises.lookup = original;
      }
    });
  });

  describe("production ignores private-network bypass", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFlag = process.env.QA_LAB_ALLOW_PRIVATE_NETWORK;

    afterEach(() => {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevFlag === undefined) delete process.env.QA_LAB_ALLOW_PRIVATE_NETWORK;
      else process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = prevFlag;
    });

    it("blocks 127.0.0.1 even with flag when NODE_ENV=production", async () => {
      process.env.NODE_ENV = "production";
      process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = "1";
      await assert.rejects(
        () => assertSafeScanUrl("http://127.0.0.1/", { allowPrivateNetwork: true }),
        /Blocked/,
      );
    });

    it("blocks [::1] even with flag when NODE_ENV=production", async () => {
      process.env.NODE_ENV = "production";
      process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = "1";
      await assert.rejects(
        () => assertSafeScanUrl("http://[::1]/", { allowPrivateNetwork: true }),
        /Blocked/,
      );
    });

    it("blocks 169.254.169.254 even with flag when NODE_ENV=production", async () => {
      process.env.NODE_ENV = "production";
      process.env.QA_LAB_ALLOW_PRIVATE_NETWORK = "1";
      await assert.rejects(
        () =>
          assertSafeScanUrl("http://169.254.169.254/latest/meta-data/", {
            allowPrivateNetwork: true,
          }),
        /Blocked/,
      );
    });
  });

});
