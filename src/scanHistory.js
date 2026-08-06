const fs = require("fs");
const path = require("path");

const HISTORY_DIR = path.join(__dirname, "../reports/history");

// Hostnames are already DNS-restricted to a safe character set, but
// sanitize defensively anyway rather than trust that blindly for a
// filesystem path.
function sanitizeHost(url) {
    try {
        return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "_") || "unknown-host";
    } catch {
        return "unknown-host";
    }
}

function historyDirFor(url) {
    return path.join(HISTORY_DIR, sanitizeHost(url));
}

function timestampToFilename(timestamp) {
    return `${(timestamp || new Date().toISOString()).replace(/[:.]/g, "-")}.json`;
}

// Saves a full report snapshot (same shape reportData.js produces) as
// its own timestamped file, so every past scan for a site is a
// standalone JSON file, not a single mutable "latest" record.
function saveScanToHistory(reportData) {
    const dir = historyDirFor(reportData.url);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, timestampToFilename(reportData.timestamp));
    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));

    return filePath;
}

// Lightweight summary of every past scan for a site, sorted oldest to
// newest. Reads each file's full content but only keeps the small
// summary fields -- fine at CLI-tool scale (one user, occasional
// scans), not something that needs a separate index file to stay fast.
function loadScanHistory(url) {
    const dir = historyDirFor(url);

    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
        .filter(file => file.endsWith(".json"))
        .map(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
                return {
                    timestamp: data.timestamp,
                    score: data.score?.score ?? null,
                    grade: data.score?.grade ?? null,
                    pagesScanned: data.summary?.pagesScanned ?? null,
                    issuesFound: data.summary?.issuesFound ?? null,
                    file
                };
            } catch {
                // A corrupted/partial history file shouldn't break every
                // other command that reads history.
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Full report data (not just the summary) for the most recent scan
// before `excludeTimestamp` -- used by scan comparison, which needs
// the actual findings list, not just score/grade numbers.
function getPreviousFullScan(url, excludeTimestamp) {
    const dir = historyDirFor(url);
    const history = loadScanHistory(url).filter(entry => entry.timestamp !== excludeTimestamp);

    if (history.length === 0) return null;

    const mostRecent = history[history.length - 1];

    try {
        return JSON.parse(fs.readFileSync(path.join(dir, mostRecent.file), "utf8"));
    } catch {
        return null;
    }
}

module.exports = {
    saveScanToHistory,
    loadScanHistory,
    getPreviousFullScan,
    sanitizeHost,
    historyDirFor
};
