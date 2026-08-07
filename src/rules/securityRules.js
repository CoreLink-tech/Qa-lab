const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

const SERVER_VERSION_PATTERN = /\/?\d+\.\d+/;

// Purely passive: these are matched against HTML the crawl already fetched,
// no extra requests. Each pattern is specific enough that a normal page
// (not actually erroring) shouldn't trigger it -- generic words like
// "error" or "warning" are deliberately excluded to avoid false positives
// on ordinary content (form validation messages, blog posts about errors,
// etc). One match per page is enough to flag it; we don't need to find
// every occurrence.
const ERROR_DISCLOSURE_SIGNATURES = [
    { system: "MySQL", pattern: /you have an error in your sql syntax|mysql_fetch_(array|assoc|row)\(\)|mysqli?_query\(\)/i },
    { system: "PostgreSQL", pattern: /pg_query\(\)|PostgreSQL query failed|ERROR:\s+syntax error at or near/i },
    { system: "Oracle DB", pattern: /ORA-\d{5}/ },
    { system: "SQL Server", pattern: /Unclosed quotation mark after the character string|Microsoft OLE DB Provider for (SQL Server|ODBC Drivers)|System\.Data\.SqlClient\.SqlException/i },
    { system: "SQLite", pattern: /SQLITE_ERROR|sqlite3\.OperationalError/i },
    { system: "PHP", pattern: /Fatal error:.*on line \d+|Warning: .*\bin\b.*\bon line \d+|Uncaught (Error|Exception):/ },
    { system: "Node.js/Express", pattern: /at\s+[\w$.]+\s+\(\/[^)]+\.js:\d+:\d+\)[\s\S]{0,200}at\s+[\w$.]+\s+\(\/[^)]+\.js:\d+:\d+\)/ },
    { system: "Java", pattern: /java\.lang\.(NullPointerException|ClassNotFoundException|RuntimeException)|at [\w.]+\([\w.]+\.java:\d+\)/ },
    { system: "Ruby on Rails", pattern: /ActiveRecord::(StatementInvalid|RecordNotFound)|app\/controllers\/[\w_]+\.rb:\d+/ },
    { system: "Python/Django", pattern: /Traceback \(most recent call last\)|django\.db\.utils\.\w+Error/ }
];

function detectErrorDisclosure(html) {
    if (!html) return null;

    for (const { system, pattern } of ERROR_DISCLOSURE_SIGNATURES) {
        const match = html.match(pattern);
        if (match) {
            return { system, match: match[0].slice(0, 120) };
        }
    }

    return null;
}

module.exports = {
    id: "SECURITY",
    name: "Security Headers",
    category: Category.SECURITY,
    description: "Checks HTTP security headers, HTTPS enforcement, CSP quality, cookie flags, mixed content, server fingerprinting, and disclosed database/application errors.",
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

            const cookies = page.cookies || [];
            const insecureCookies = cookies.filter(c => !c.secure);
            const nonHttpOnlyCookies = cookies.filter(c => !c.httpOnly);

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

            const disclosedError = detectErrorDisclosure(page.html);

            if (disclosedError) {
                findings.push(createFinding({
                    id: "SEC010",
                    title: "Database or Application Error Disclosed",
                    category: Category.SECURITY,
                    severity: Severity.HIGH,
                    page: page.url,
                    details: `Page response contains a ${disclosedError.system} error/stack trace. Matched: "${disclosedError.match}"`,
                    recommendation: "Disable verbose error output in production (display_errors off, custom error pages, generic 500 responses) so database schema, file paths, and query structure aren't leaked to visitors.",
                    documentation: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/08-Testing_for_Error_Handling/01-Testing_For_Improper_Error_Handling"
                }));
            }
        }

        return findings;
    }
};
