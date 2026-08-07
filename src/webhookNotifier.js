const { httpClient } = require("./utils/httpClient");

// A generic JSON payload any endpoint that accepts POST JSON can consume
// (Zapier, n8n, a custom CI listener, etc.). This is NOT the same as a
// native Slack/Discord integration -- those expect their own specific
// payload shapes (Slack's "blocks", Discord's "embeds"), and building
// each of those properly is its own scoped feature, not something to
// fake by reusing this generic shape.
function buildWebhookPayload(reportData, gateResult = null) {
    return {
        url: reportData.url,
        timestamp: reportData.timestamp,
        score: reportData.score?.score ?? null,
        grade: reportData.score?.grade ?? null,
        severity: reportData.score?.severity ?? null,
        pagesScanned: reportData.summary?.pagesScanned ?? null,
        issuesFound: reportData.summary?.issuesFound ?? null,
        qualityGate: gateResult
            ? { passed: gateResult.passed, reasons: gateResult.reasons }
            : null
    };
}

// A webhook failing to deliver shouldn't fail the whole scan -- the
// scan already succeeded and its reports are already written by the
// time this runs. Returns { url, success, error } per target rather
// than throwing, so the caller can report failures without treating
// them as fatal.
async function sendWebhook(url, payload) {
    try {
        await httpClient.post(url, payload, {
            headers: { "Content-Type": "application/json" }
        });
        return { url, success: true, error: null };
    } catch (error) {
        return { url, success: false, error: error.message };
    }
}

async function sendWebhooks(urls, reportData, gateResult = null) {
    const payload = buildWebhookPayload(reportData, gateResult);
    const results = [];

    for (const url of urls) {
        results.push(await sendWebhook(url, payload));
    }

    return results;
}

module.exports = { buildWebhookPayload, sendWebhook, sendWebhooks };
