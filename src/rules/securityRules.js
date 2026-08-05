const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

const SERVER_VERSION_PATTERN = /\/?\d+\.\d+/;

function getCookies(headers) {
    const raw = headers["set-cookie"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
}

module.exports = {
    id: "SECURITY",
    name: "Security Headers",
    category: Category.SECURITY,
    description: "Checks HTTP security headers, HTTPS enforcement, CSP quality, cookie flags, mixed content, and server fingerprinting.",
    enabled: true,

    run(websiteModel) {

        const findings = [];

        for (const page of websiteModel.pages) {

            if (page.url && page.url.startsWith("http://")) {
                findings.push(createFinding({
                    id: "SEC005",
                    title: "Site Not Served Over HTTPS",
                    category: Category.SECURITY,
                    severity: Severity.HIGH,
                    page: page.url,
                    details: "Page was loaded over plain HTTP instead of HTTPS.",
                    recommendation: "Serve all traffic over HTTPS and redirect HTTP requests to HTTPS.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security"
                }));
            }

            if (!page.headers) continue;

            const headers = page.headers;

            if (!headers["content-security-policy"]) {
                findings.push(createFinding({
                    id: "SEC001",
                    title: "Missing Content-Security-Policy Header",
                    category: Category.SECURITY,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: "Missing Content-Security-Policy header.",
                    recommendation: "Add a Content-Security-Policy (CSP) header to reduce XSS and code injection attacks.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"
                }));
            } else {
                const csp = headers["content-security-policy"];
                const isWeak = /unsafe-inline|unsafe-eval|(^|\s)\*(\s|;|$)/.test(csp);

                if (isWeak) {
                    findings.push(createFinding({
                        id: "SEC006",
                        title: "Permissive Content-Security-Policy",
                        category: Category.SECURITY,
                        severity: Severity.MEDIUM,
                        page: page.url,
                        details: "CSP header allows 'unsafe-inline', 'unsafe-eval', or a wildcard source.",
                        recommendation: "Avoid 'unsafe-inline'/'unsafe-eval' and wildcard sources in your CSP; they significantly weaken its protection.",
                        documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"
                    }));
                }
            }

            if (!headers["x-frame-options"]) {
                findings.push(createFinding({
                    id: "SEC002",
                    title: "Missing X-Frame-Options Header",
                    category: Category.SECURITY,
                    severity: Severity.LOW,
                    page: page.url,
                    details: "Missing X-Frame-Options header.",
                    recommendation: "Set X-Frame-Options to DENY or SAMEORIGIN to help prevent clickjacking.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options"
                }));
            }

            if (!headers["strict-transport-security"]) {
                findings.push(createFinding({
                    id: "SEC003",
                    title: "Missing Strict-Transport-Security Header",
                    category: Category.SECURITY,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: "Missing Strict-Transport-Security header.",
                    recommendation: "Enable HSTS to force browsers to communicate only over HTTPS.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security"
                }));
            }

            if (!headers["x-content-type-options"]) {
                findings.push(createFinding({
                    id: "SEC004",
                    title: "Missing X-Content-Type-Options Header",
                    category: Category.SECURITY,
                    severity: Severity.LOW,
                    page: page.url,
                    details: "Missing X-Content-Type-Options header.",
                    recommendation: "Set X-Content-Type-Options to 'nosniff' to prevent MIME-type sniffing.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options"
                }));
            }

            const server = headers["server"];

            if (server && SERVER_VERSION_PATTERN.test(server)) {
                findings.push(createFinding({
                    id: "SEC007",
                    title: "Server Header Discloses Version Information",
                    category: Category.SECURITY,
                    severity: Severity.INFO,
                    page: page.url,
                    details: `Server header reveals version info: "${server}"`,
                    recommendation: "Configure your server to omit or generalize the Server header so it doesn't advertise exact software versions to attackers.",
                    documentation: "https://owasp.org/www-project-web-security-testing-guide/"
                }));
            }

            const cookies = getCookies(headers);
            const insecureCookies = cookies.filter(c => !/;\s*secure/i.test(c));
            const nonHttpOnlyCookies = cookies.filter(c => !/;\s*httponly/i.test(c));

            if (insecureCookies.length > 0 || nonHttpOnlyCookies.length > 0) {
                findings.push(createFinding({
                    id: "SEC008",
                    title: "Cookie Missing Secure or HttpOnly Flag",
                    category: Category.SECURITY,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: `${insecureCookies.length} cookie(s) missing Secure, ${nonHttpOnlyCookies.length} missing HttpOnly.`,
                    recommendation: "Set the Secure and HttpOnly flags on all cookies, especially session cookies.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie"
                }));
            }

            const mixedContentCount = page.mixedContentCount || 0;

            if (mixedContentCount > 0) {
                findings.push(createFinding({
                    id: "SEC009",
                    title: "Mixed Content Detected",
                    category: Category.SECURITY,
                    severity: Severity.MEDIUM,
                    page: page.url,
                    details: `${mixedContentCount} resource(s) are loaded over plain HTTP on an HTTPS page.`,
                    recommendation: "Load all resources (images, scripts, stylesheets) over HTTPS to avoid mixed content warnings and security risks.",
                    documentation: "https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content"
                }));
            }
        }

        return findings;
    }
};
