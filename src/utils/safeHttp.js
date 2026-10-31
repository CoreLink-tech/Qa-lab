/**
 * Safe outbound HTTP for user-influenced URLs.
 *
 * - Validates URL via assertSafeScanUrl (DNS + IP policy)
 * - Connects to a pinned resolved IP (custom lookup) to close rebinding window
 * - Follows redirects manually (max hops), re-validating each Location
 * - Caps response size, connect/total timeouts, allowed ports
 */

"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");
const axios = require("axios");
const { assertSafeScanUrl, stripIpv6Brackets } = require("./ssrfGuard");

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MiB
const USER_AGENT = "QA-Lab/1.0 (+https://github.com/CoreLink-tech/Qa-lab)";

/**
 * Build an http/https agent that always dials `pinnedIp` regardless of hostname.
 * Host header / SNI still use the original hostname (passed separately to axios).
 * @param {string} pinnedIp
 * @param {boolean} isHttps
 */
function createPinnedAgent(pinnedIp, isHttps) {
  const family = pinnedIp.includes(":") ? 6 : 4;
  const lookup = (_hostname, options, callback) => {
    // Node 18+ may call with (hostname, options, cb) or (hostname, cb)
    if (typeof options === "function") {
      callback = options;
    }
    callback(null, pinnedIp, family);
  };

  const opts = {
    lookup,
    keepAlive: false,
    timeout: DEFAULT_CONNECT_TIMEOUT_MS,
  };

  return isHttps ? new https.Agent(opts) : new http.Agent(opts);
}

/**
 * Perform a single request to an already-validated target, pinned to one IP.
 * Does not follow redirects.
 *
 * @param {object} validated - return value of assertSafeScanUrl
 * @param {object} [opts]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function requestPinned(validated, opts = {}) {
  const method = (opts.method || "GET").toUpperCase();
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBody = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const headers = {
    "User-Agent": USER_AGENT,
    ...(opts.headers || {}),
  };

  const isHttps = validated.protocol === "https:";
  const addresses =
    validated.resolvedAddresses && validated.resolvedAddresses.length
      ? validated.resolvedAddresses
      : null;

  if (!addresses || addresses.length === 0) {
    throw new Error("No resolved addresses to pin");
  }

  // Prefer IPv4 for broader compatibility when both exist
  const pinnedIp =
    addresses.find((a) => !a.includes(":")) || addresses[0];

  const agent = createPinnedAgent(pinnedIp, isHttps);
  const axiosConfig = {
    method,
    url: validated.href,
    timeout,
    maxRedirects: 0,
    // Validate status ourselves for redirect handling
    validateStatus: () => true,
    headers,
    httpAgent: isHttps ? undefined : agent,
    httpsAgent: isHttps ? agent : undefined,
    // Ensure Host matches original hostname (axios sets from URL)
    maxContentLength: maxBody,
    maxBodyLength: maxBody,
    responseType: opts.responseType || "text",
    data: opts.data,
    transitional: { clarifyTimeoutError: true },
  };

  try {
    return await axios(axiosConfig);
  } finally {
    agent.destroy();
  }
}

/**
 * Safe GET/POST with SSRF checks, IP pinning, and manual redirect following.
 *
 * @param {string} urlString
 * @param {object} [opts]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function safeRequest(urlString, opts = {}) {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let currentUrl = urlString;
  /** @type {import('axios').AxiosResponse|null} */
  let response = null;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validated = await assertSafeScanUrl(currentUrl, {
      allowHttp: opts.allowHttp !== false,
      resolveDns: true,
      allowedPorts: opts.allowedPorts,
    });

    response = await requestPinned(validated, {
      method: opts.method || "GET",
      headers: opts.headers,
      data: opts.data,
      timeoutMs: opts.timeoutMs,
      maxBodyBytes: opts.maxBodyBytes,
      responseType: opts.responseType,
    });

    const status = response.status;
    if (status >= 300 && status < 400 && response.headers.location) {
      if (hop === maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects})`);
      }
      const next = new URL(response.headers.location, currentUrl);
      // Block scheme downgrade from https → http
      if (
        validated.protocol === "https:" &&
        next.protocol === "http:" &&
        opts.allowHttpsDowngrade !== true
      ) {
        throw new Error("Blocked HTTPS to HTTP redirect");
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new Error(`Blocked redirect scheme: ${next.protocol}`);
      }
      currentUrl = next.href;
      continue;
    }

    return response;
  }

  throw new Error("Redirect loop exceeded");
}

async function safeGet(urlString, opts = {}) {
  return safeRequest(urlString, { ...opts, method: "GET" });
}

async function safePost(urlString, data, opts = {}) {
  return safeRequest(urlString, { ...opts, method: "POST", data });
}

module.exports = {
  safeRequest,
  safeGet,
  safePost,
  requestPinned,
  createPinnedAgent,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_MAX_BODY_BYTES,
  USER_AGENT,
};
