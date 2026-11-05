/**
 * Shared HTTP surface for the scanner.
 * All user-influenced URLs MUST go through safeGet / safePost (SSRF-safe).
 */

"use strict";

const axios = require("axios");
const {
  safeGet,
  safePost,
  safeRequest,
  USER_AGENT,
  DEFAULT_TIMEOUT_MS,
} = require("./safeHttp");

const REQUEST_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

const httpClient = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  maxRedirects: 0,
  headers: {
    "User-Agent": USER_AGENT,
  },
});

httpClient.get = function safeClientGet(url, config = {}) {
  return safeGet(url, {
    headers: config.headers,
    timeoutMs: config.timeout || REQUEST_TIMEOUT_MS,
    responseType: config.responseType,
    maxBodyBytes: config.maxContentLength,
    signal: config.signal,
  });
};

httpClient.post = function safeClientPost(url, data, config = {}) {
  return safePost(url, data, {
    headers: config.headers,
    timeoutMs: config.timeout || REQUEST_TIMEOUT_MS,
    responseType: config.responseType,
    signal: config.signal,
  });
};

module.exports = {
  httpClient,
  safeGet,
  safePost,
  safeRequest,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
};
