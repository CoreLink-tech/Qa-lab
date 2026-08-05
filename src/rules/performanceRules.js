const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

// Below this size, compression overhead isn't worth flagging.
const COMPRESSION_MIN_SIZE_BYTES = 1024;
const LARGE_PAGE_THRESHOLD_BYTES = 500 * 1024;

module.exports = {
    id: "PERFORMANCE",
    name: "Performance Rules",
    category: Category.PERFORMANCE,
    description: "Checks page response times, compression, caching headers, and overall page weight.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            const responseTime = page.responseTime;

            if (typeof responseTime === "number") {

                if (responseTime > 5000) {
                    findings.push(createFinding({
                        id: "PERF001",
                        title: "Very Slow Page Response",
                        category: Category.PERFORMANCE,
                        severity: Severity.HIGH,
                        page: page.url,
                        details: `Page response time is ${responseTime} ms.`,
                        recommendation: "Reduce server response time to under 2 seconds by optimizing backend processing, database queries, caching, and infrastructure.",
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/Performance"
                    }));
                } else if (responseTime > 2000) {
                    findings.push(createFinding({
                        id: "PERF002",
                        title: "Slow Page Response",
                        category: Category.PERFORMANCE,
                        severity: Severity.MEDIUM,
                        page: page.url,
                        details: `Page response time is ${responseTime} ms.`,
                        recommendation: "Optimize backend processing, caching, and database queries to improve response time.",
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/Performance"
                    }));
                }
            }

            const htmlSize = page.htmlSize || 0;
            const headers = page.headers || {};

            if (htmlSize > COMPRESSION_MIN_SIZE_BYTES && !headers["content-encoding"]) {
                findings.push(createFinding({
                    id: "PERF003",
                    title: "Response Not Compressed",
                    category: Category.PERFORMANCE,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: `Page is ${Math.round(htmlSize / 1024)} KB with no Content-Encoding header (gzip/br/deflate).`,
                    recommendation: "Enable gzip or Brotli compression on your server to reduce transfer size.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding"
                }));
            }

            if (!headers["cache-control"]) {
                findings.push(createFinding({
                    id: "PERF004",
                    title: "Missing Cache-Control Header",
                    category: Category.PERFORMANCE,
                    severity: Severity.LOW,
                    page: page.url,
                    details: "Response does not specify a Cache-Control header.",
                    recommendation: "Set an appropriate Cache-Control header so browsers and CDNs can cache the response.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control"
                }));
            }

            if (htmlSize > LARGE_PAGE_THRESHOLD_BYTES) {
                findings.push(createFinding({
                    id: "PERF005",
                    title: "Large HTML Payload",
                    category: Category.PERFORMANCE,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: `HTML document is ${Math.round(htmlSize / 1024)} KB.`,
                    recommendation: "Reduce initial HTML size: paginate large lists, lazy-load below-the-fold content, and trim unnecessary markup.",
                    documentation: "https://web.dev/articles/reduce-network-payloads-using-text-compression"
                }));
            }
        }

        return findings;
    }
};
