const { httpClient } = require("./utils/httpClient");

// Deliberately minimal: only tracks Disallow rules under a wildcard
// (User-agent: *) block, treated as prefix matches. Does NOT implement
// Allow-overrides-Disallow precedence, wildcard (*) or end-anchor ($)
// patterns within rules, Crawl-delay, or per-bot-name blocks other than
// "*". This covers the overwhelming majority of real robots.txt files
// (simple Disallow: /path prefixes) without pretending to be a full
// RFC 9309 implementation.
function parseRobotsTxt(text) {
    const lines = (text || "").split("\n").map(line => line.trim());
    const disallowed = [];
    let inWildcardBlock = false;

    for (const line of lines) {
        if (/^user-agent:\s*\*\s*$/i.test(line)) {
            inWildcardBlock = true;
            continue;
        }

        if (/^user-agent:/i.test(line)) {
            inWildcardBlock = false;
            continue;
        }

        if (inWildcardBlock) {
            const match = line.match(/^disallow:\s*(.*)$/i);
            if (match && match[1]) {
                disallowed.push(match[1].trim());
            }
        }
    }

    return { disallowed };
}

async function fetchRobotsRules(baseUrl) {
    try {
        const robotsUrl = new URL("/robots.txt", baseUrl).href;
        const response = await httpClient.get(robotsUrl);
        return parseRobotsTxt(response.data);
    } catch {
        // No robots.txt, or it failed to fetch -- treat as "everything
        // allowed" rather than blocking the whole crawl over this.
        return { disallowed: [] };
    }
}

function isAllowed(rules, path) {
    if (!rules || !rules.disallowed.length) return true;
    return !rules.disallowed.some(prefix => prefix && path.startsWith(prefix));
}

module.exports = { fetchRobotsRules, parseRobotsTxt, isAllowed };
