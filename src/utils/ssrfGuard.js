/**
 * SSRF protection: validate user-supplied URLs before any outbound request.
 *
 * Design:
 * - Strip IPv6 brackets before classification
 * - Use ipaddr.js for CIDR / special-range checks (IPv4-mapped, etc.)
 * - Always resolve DNS when resolveDns is true (default) and reject if ANY
 *   A/AAAA record is blocked
 * - Callers that perform HTTP must use safeHttp (pinned IP + manual redirects)
 *
 * Dependency justification: `ipaddr.js` — widely used, maintained, handles
 * IPv4-mapped IPv6 and CIDR membership correctly; avoids hand-rolled range bugs.
 */

"use strict";

const { URL } = require("url");
const net = require("net");
const dns = require("dns").promises;
const ipaddr = require("ipaddr.js");

/** Hostnames that must never be contacted (metadata / loopback aliases). */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
  "metadata",
]);

/** Default allowed ports for scan targets. */
const DEFAULT_ALLOWED_PORTS = new Set([80, 443]);

/**
 * IPv4 CIDR ranges that must be blocked (private, special, metadata-adjacent).
 * @type {Array<[string, number]>}
 */
const BLOCKED_IPV4_CIDRS = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const BLOCKED_IPV6_CIDRS = [
  ["::1", 128],
  ["::", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["64:ff9b::", 96],
];

function stripIpv6Brackets(hostname) {
  if (
    typeof hostname === "string" &&
    hostname.startsWith("[") &&
    hostname.endsWith("]")
  ) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function embeddedIpv4(addr) {
  if (typeof addr.isIPv4MappedAddress === "function" && addr.isIPv4MappedAddress()) {
    return addr.toIPv4Address().toString();
  }
  try {
    const parts = addr.parts;
    if (
      parts[0] === 0x64 &&
      parts[1] === 0xff9b &&
      parts[2] === 0 &&
      parts[3] === 0 &&
      parts[4] === 0 &&
      parts[5] === 0
    ) {
      const hi = parts[6];
      const lo = parts[7];
      return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isBlockedIp(ip) {
  let parsed;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return true;
  }

  if (parsed.kind() === "ipv4") {
    for (const [range, prefix] of BLOCKED_IPV4_CIDRS) {
      try {
        if (parsed.match(ipaddr.parse(range), prefix)) return true;
      } catch {
        /* continue */
      }
    }
    return false;
  }

  const asV4 = embeddedIpv4(parsed);
  if (asV4 && isBlockedIp(asV4)) return true;

  for (const [range, prefix] of BLOCKED_IPV6_CIDRS) {
    try {
      if (parsed.match(ipaddr.parse(range), prefix)) return true;
    } catch {
      /* continue */
    }
  }

  try {
    const parts = parsed.parts;
    if (parts[0] === 0x2002) {
      const a = (parts[1] >> 8) & 0xff;
      const b = parts[1] & 0xff;
      const c = (parts[2] >> 8) & 0xff;
      const d = parts[2] & 0xff;
      if (isBlockedIp(`${a}.${b}.${c}.${d}`)) return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

function isPrivateOrReservedIPv4(ip) {
  return isBlockedIp(ip);
}

function isPrivateOrReservedIPv6(ip) {
  return isBlockedIp(ip);
}

async function assertSafeScanUrl(urlString, options = {}) {
  const allowHttp = options.allowHttp !== false;
  const resolveDns = options.resolveDns !== false;
  // Never honour private-network bypass in production (hostile multi-tenant SaaS).
  const allowPrivateNetwork =
    process.env.NODE_ENV !== "production" &&
    (options.allowPrivateNetwork === true ||
      process.env.QA_LAB_ALLOW_PRIVATE_NETWORK === "1");
  const allowedPorts = options.allowedPorts
    ? new Set(options.allowedPorts)
    : DEFAULT_ALLOWED_PORTS;

  if (typeof urlString !== "string" || !urlString.trim()) {
    throw new Error("Invalid URL: empty");
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Disallowed URL scheme: ${parsed.protocol}`);
  }
  if (parsed.protocol === "http:" && !allowHttp) {
    throw new Error("HTTP URLs are not allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed");
  }

  let hostname = stripIpv6Brackets(parsed.hostname);
  if (!hostname) {
    throw new Error("Invalid URL: missing hostname");
  }

  const hostnameLower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostnameLower) && !allowPrivateNetwork) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  let port = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === "https:"
      ? 443
      : 80;
  if (!allowedPorts.has(port)) {
    // Local integration tests use ephemeral ports on loopback
    if (!(allowPrivateNetwork && port >= 1024 && port <= 65535)) {
      throw new Error(`Port ${port} is not allowed`);
    }
  }

  let isLiteralIp = net.isIP(hostname) !== 0;
  if (!isLiteralIp) {
    try {
      ipaddr.parse(hostname);
      isLiteralIp = true;
    } catch {
      isLiteralIp = false;
    }
  }

  let resolvedAddresses = [];

  if (isLiteralIp) {
    if (isBlockedIp(hostname) && !allowPrivateNetwork) {
      throw new Error(`Blocked private/reserved address: ${hostname}`);
    }
    resolvedAddresses = [hostname];
  } else if (resolveDns) {
    let records;
    try {
      records = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new Error(`Unable to resolve hostname: ${hostname}`);
    }
    if (!records || records.length === 0) {
      throw new Error(`Unable to resolve hostname: ${hostname}`);
    }
    for (const rec of records) {
      if (isBlockedIp(rec.address) && !allowPrivateNetwork) {
        throw new Error(
          `Hostname ${hostname} resolves to blocked address ${rec.address}`,
        );
      }
      resolvedAddresses.push(rec.address);
    }
  }

  parsed.username = "";
  parsed.password = "";

  return {
    href: parsed.href,
    hostname: stripIpv6Brackets(parsed.hostname),
    protocol: parsed.protocol,
    port,
    resolvedAddresses,
  };
}

module.exports = {
  assertSafeScanUrl,
  isBlockedIp,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  stripIpv6Brackets,
  DEFAULT_ALLOWED_PORTS,
  BLOCKED_HOSTNAMES,
};
