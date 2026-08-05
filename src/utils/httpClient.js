const axios = require("axios");

// Shared by every module that fetches a page (crawler, pageScanner) so
// timeout/UA/etc. are configured once instead of duplicated per module.
const REQUEST_TIMEOUT_MS = 10000;
const USER_AGENT = "QA-Lab/1.0 (+https://github.com/CoreLink-tech/Qa-lab)";

const httpClient = axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        "User-Agent": USER_AGENT
    }
    // Deliberately NOT overriding validateStatus: keep axios's default
    // (reject on non-2xx/3xx) so the existing try/catch + error.response
    // handling in crawler.js and pageScanner.js keeps working unchanged.
});

module.exports = { httpClient, REQUEST_TIMEOUT_MS, USER_AGENT };
