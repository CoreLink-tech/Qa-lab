const { httpClient } = require("./utils/httpClient");
const { mapWithConcurrency } = require("./utils/concurrency");

// Every entry here is a *read-only GET* against a well-known, static path.
// This never sends a payload, never attempts authentication bypass, and
// never targets anything other than the exact URLs listed -- it's the
// passive-recon equivalent of trying a site's front door to see if it's
// unlocked, not picking the lock. category "sensitive-file" entries are
// genuinely bad if exposed; "recon" entries (default admin paths) are
// informational only, since a site having an admin panel at a common URL
// isn't itself a vulnerability.
const CANDIDATE_PATHS = [
    { path: "/.env", category: "sensitive-file", label: ".env file", signature: /^[\w.]+=.*$/m },
    { path: "/.git/HEAD", category: "sensitive-file", label: ".git repository", signature: /^ref:\s|^[0-9a-f]{40}$/m },
    { path: "/.git/config", category: "sensitive-file", label: ".git repository", signature: /\[core\]/ },
    { path: "/wp-config.php.bak", category: "sensitive-file", label: "WordPress config backup", signature: /DB_PASSWORD|DB_NAME/ },
    { path: "/config.php.bak", category: "sensitive-file", label: "Config backup file", signature: null },
    { path: "/.htpasswd", category: "sensitive-file", label: ".htpasswd credentials file", signature: /:\$?\w/ },
    { path: "/backup.sql", category: "sensitive-file", label: "SQL database backup", signature: /CREATE TABLE|INSERT INTO/i },
    { path: "/database.sql", category: "sensitive-file", label: "SQL database backup", signature: /CREATE TABLE|INSERT INTO/i },
    { path: "/.DS_Store", category: "sensitive-file", label: ".DS_Store (directory metadata)", signature: null },
    { path: "/phpinfo.php", category: "sensitive-file", label: "phpinfo() output", signature: /PHP Version|phpinfo\(\)/i },
    { path: "/uploads/", category: "directory-listing", label: "Directory listing enabled (/uploads/)", signature: /<title>Index of |<h1>Index of /i },
    { path: "/assets/", category: "directory-listing", label: "Directory listing enabled (/assets/)", signature: /<title>Index of |<h1>Index of /i },
    { path: "/backup/", category: "directory-listing", label: "Directory listing enabled (/backup/)", signature: /<title>Index of |<h1>Index of /i },
    { path: "/admin", category: "recon", label: "Admin panel at a default path", signature: null },
    { path: "/wp-admin/", category: "recon", label: "WordPress admin panel at a default path", signature: null },
    { path: "/administrator", category: "recon", label: "Admin panel at a default path", signature: null }
];

const SECURITY_TXT_PATH = "/.well-known/security.txt";

// Random, unguessable path used to see how the site responds to something
// that definitely doesn't exist. Some sites return 200 for everything
// (soft-404 / SPA catch-all) instead of a real 404 -- without this baseline
// every candidate path would look "exposed."
function baselinePath() {
    return `/qa-lab-baseline-check-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

async function fetchPath(baseUrl, path) {
    try {
        const response = await httpClient.get(new URL(path, baseUrl).href, {
            maxRedirects: 0,
            validateStatus: () => true, // we want to inspect any status ourselves, not just 2xx
            responseType: "text",
            maxContentLength: 1024 * 1024 // 1MB is plenty to check a signature; this isn't a download
        });

        return {
            path,
            status: response.status,
            body: typeof response.data === "string" ? response.data.slice(0, 4000) : ""
        };
    } catch (error) {
        return { path, status: error.response?.status || null, body: "", error: error.message };
    }
}

function looksLikeRealFile(result, baseline, signature) {
    if (!result.status || result.status >= 400) return false;
    if (baseline.status && baseline.status < 400 && baseline.status === result.status) {
        // Site returns the same "success" status for a path we know doesn't
        // exist -- only trust this result if it also has a distinguishing
        // signature the baseline response wouldn't have.
        if (!signature) return false;
        return signature.test(result.body) && !signature.test(baseline.body);
    }

    if (signature) return signature.test(result.body);

    // No signature to check and the baseline behaved normally (404) -- a
    // 2xx/3xx here is meaningful on its own (e.g. .DS_Store, admin paths).
    return true;
}

// Probes CANDIDATE_PATHS plus the security.txt convention. Off by default
// (--check-exposed-paths) since, like checkAssets, it's extra requests
// against whatever site is being scanned, beyond normal page fetching.
async function checkExposedPaths(baseUrl, { concurrency = 5 } = {}) {
    console.log(`Checking ${CANDIDATE_PATHS.length + 1} well-known path(s)...`);

    const baseline = await fetchPath(baseUrl, baselinePath());

    const [candidateResults, securityTxtResult] = await Promise.all([
        mapWithConcurrency(CANDIDATE_PATHS, concurrency, c => fetchPath(baseUrl, c.path)),
        fetchPath(baseUrl, SECURITY_TXT_PATH)
    ]);

    const exposed = CANDIDATE_PATHS
        .map((candidate, i) => ({ candidate, result: candidateResults[i] }))
        .filter(({ candidate, result }) => looksLikeRealFile(result, baseline, candidate.signature))
        .map(({ candidate, result }) => ({
            path: candidate.path,
            category: candidate.category,
            label: candidate.label,
            status: result.status
        }));

    const hasSecurityTxt = looksLikeRealFile(securityTxtResult, baseline, null);

    return { exposed, hasSecurityTxt };
}

module.exports = { checkExposedPaths, CANDIDATE_PATHS };
