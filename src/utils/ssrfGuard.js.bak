/**
 * SSRF protection helpers.
 *
 * Never trust a user-supplied URL. Before any outbound request (crawl,
 * exposed-path probe, asset check, etc.) the start URL and discovered
 * targets should be validated against private/link-local/metadata ranges
 * and disallowed schemes.
 *
 * This module is intentionally conservative. Callers may add allow-lists
 * on top (e.g. only scan domains belonging to the authenticated org).
 */

"use strict";

const { URL } = require("url");
const net = require("net");
const dns = require("dns").promises;

/** Hostnames / IPs that must never be contacted. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
]);

/**
 * Returns true if the IPv4 address is private, loopback, link-local, or
 * otherwise non-routable / dangerous for SSRF.
 * @param {string} ip
 */
function isPrivateOrReservedIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed → treat as blocked
  }
  const [a, b] = parts;
  // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16 (link-local + cloud metadata),
  // 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10 (CGNAT), 192.0.0.0/24, etc.
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/**
 * Basic IPv6 private / loopback / link-local check (conservative).
 * @param {string} ip
 */
function isPrivateOrReservedIPv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  if (normalized.startsWith("ff")) return true; // multicast
  return false;
}

/**
 * Validate a URL string before using it as a scan target.
 * Throws on invalid / blocked targets.
 *
 * @param {string} urlString
 * @param {{ allowHttp?: boolean, resolveDns?: boolean }} [options]
 * @returns {Promise<{ href: string, hostname: string, protocol: string }>}
 */
async function assertSafeScanUrl(urlString, options = {}) {
  const allowHttp = options.allowHttp !== false; // default allow http for public sites
  const resolveDns = options.resolveDns === true; // opt-in because of extra latency

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    throw new Error(`Disallowed URL scheme: ${protocol}`);
  }
  if (protocol === "http:" && !allowHttp) {
    throw new Error("HTTP URLs are not allowed by policy");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new Error("URL must have a hostname");
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  // Literal IP in the URL
  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isPrivateOrReservedIPv4(hostname)) {
      throw new Error(`Blocked private/reserved IPv4 address: ${hostname}`);
    }
    if (net.isIPv6(hostname) && isPrivateOrReservedIPv6(hostname)) {
      throw new Error(`Blocked private/reserved IPv6 address: ${hostname}`);
    }
  } else if (resolveDns) {
    // Resolve and re-check (protects against DNS rebinding to private IPs)
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const rec of records) {
        if (rec.family === 4 && isPrivateOrReservedIPv4(rec.address)) {
          throw new Error(
            `Hostname ${hostname} resolves to blocked address ${rec.address}`
          );
        }
        if (rec.family === 6 && isPrivateOrReservedIPv6(rec.address)) {
          throw new Error(
            `Hostname ${hostname} resolves to blocked address ${rec.address}`
          );
        }
      }
    } catch (err) {
      if (err.message && err.message.startsWith("Hostname")) throw err;
      // DNS failure – let the crawler surface a normal network error later,
      // but do not treat unresolved as "safe".
      throw new Error(`Unable to resolve hostname: ${hostname}`);
    }
  }

  // Strip credentials if present – we never want to log or forward them
  parsed.username = "";
  parsed.password = "";

  return {
    href: parsed.href,
    hostname: parsed.hostname,
    protocol: parsed.protocol,
  };
}

module.exports = {
  assertSafeScanUrl,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
};
