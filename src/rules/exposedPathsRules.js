const createFinding = require("../core/finding");
const Severity = require("../constants/severity");
const Category = require("../constants/categories");

const SEVERITY_BY_CATEGORY = {
    "sensitive-file": Severity.CRITICAL,
    "directory-listing": Severity.MEDIUM,
    "recon": Severity.INFO
};

module.exports = {
    id: "EXPOSED_PATHS",
    name: "Exposed Paths",
    category: Category.SECURITY,
    description: "Reads results from an opt-in probe (--check-exposed-paths) of well-known sensitive files, directory listings, and default admin paths.",
    enabled: true,

    // websiteModel.exposedPathChecks is populated by exposedPathsChecker.js
    // when --check-exposed-paths is passed; absent otherwise, in which case
    // this rule has nothing to report (not an error).
    run(websiteModel) {
        const checks = websiteModel.exposedPathChecks;
        if (!checks) return [];

        const findings = [];
        const baseUrl = websiteModel.url;

        for (const item of checks.exposed || []) {
            const url = new URL(item.path, baseUrl).href;
            const severity = SEVERITY_BY_CATEGORY[item.category] || Severity.MEDIUM;

            const idByCategory = {
                "sensitive-file": "SEC011",
                "directory-listing": "SEC012",
                "recon": "SEC013"
            };

            const recommendationByCategory = {
                "sensitive-file": "Remove this file from the publicly served directory, or block access to it at the web server/reverse proxy level. If it contained real credentials, rotate them immediately.",
                "directory-listing": "Disable directory listing/autoindex in your web server configuration for this and similar directories.",
                "recon": "Not a vulnerability by itself, but consider restricting access (IP allowlist, VPN, non-default path) since it tells an attacker where to focus credential-guessing attempts."
            };

            findings.push(createFinding({
                id: idByCategory[item.category] || "SEC011",
                title: item.label,
                category: Category.SECURITY,
                severity,
                page: url,
                details: `${item.label} appears reachable at ${url} (HTTP ${item.status}).`,
                recommendation: recommendationByCategory[item.category] || "Restrict access to this path.",
                documentation: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/"
            }));
        }

        if (checks.hasSecurityTxt === false) {
            findings.push(createFinding({
                id: "SEC014",
                title: "No security.txt Found",
                category: Category.SECURITY,
                severity: Severity.INFO,
                page: new URL("/.well-known/security.txt", baseUrl).href,
                details: "No /.well-known/security.txt file was found.",
                recommendation: "Add a security.txt file (RFC 9116) so security researchers have a clear, documented way to report vulnerabilities responsibly.",
                documentation: "https://securitytxt.org/"
            }));
        }

        return findings;
    }
};
