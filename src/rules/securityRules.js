onst createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

module.exports = {
    id: "SECURITY",
    name: "Security Headers",
    category: Category.SECURITY,
    description: "Checks for recommended HTTP security headers.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            if (!page.headers) continue;

            const headers = page.headers;

            if (!headers["content-security-policy"]) {
                findings.push(
                    createFinding({
                        id: "SEC001",
                        title: "Missing Content-Security-Policy Header",
                        category: Category.SECURITY,
                        severity: Severity.MEDIUM,
                        page: page.url,
                        details: "Missing Content-Security-Policy header.",
                        recommendation:
                            "Add a Content-Security-Policy (CSP) header to reduce XSS and code injection attacks.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"
                    })
                );
            }

            if (!headers["x-frame-options"]) {
                findings.push(
                    createFinding({
                        id: "SEC002",
                        title: "Missing X-Frame-Options Header",
                        category: Category.SECURITY,
                        severity: Severity.LOW,
                        page: page.url,
                        details: "Missing X-Frame-Options header.",
                        recommendation:
                            "Set X-Frame-Options to DENY or SAMEORIGIN to help prevent clickjacking.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options"
                    })
                );
            }

            if (!headers["strict-transport-security"]) {
                findings.push(
                    createFinding({
                        id: "SEC003",
                        title: "Missing Strict-Transport-Security Header",
                        category: Category.SECURITY,
                        severity: Severity.MEDIUM,
                        page: page.url,
                        details: "Missing Strict-Transport-Security header.",
                        recommendation:
                            "Enable HSTS to force browsers to communicate only over HTTPS.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security"
                    })
                );
            }

            if (!headers["x-content-type-options"]) {
                findings.push(
                    createFinding({
                        id: "SEC004",
                        title: "Missing X-Content-Type-Options Header",
                        category: Category.SECURITY,
                        severity: Severity.LOW,
                        page: page.url,
                        details: "Missing X-Content-Type-Options header.",
                        recommendation:
                            "Set X-Content-Type-Options to 'nosniff' to prevent MIME-type sniffing.",
                        documentation:
                            "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options"
                    })
                );
            }
        }

        return findings;
    }
};
