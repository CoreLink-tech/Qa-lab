const crypto = require("crypto");
const { httpClient } = require("./utils/httpClient");
const { mapWithConcurrency } = require("./utils/concurrency");

// Caps a single asset fetch so one huge accidental video/PDF reference
// can't stall a scan or blow up memory. Assets over this are recorded
// as "too large to fully verify" rather than downloaded in full.
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

function collectAssetUrls(websiteModel) {
    const urls = new Set();

    for (const page of websiteModel.pages) {
        const base = page.url;

        for (const script of page.scripts || []) {
            if (script.src) {
                try { urls.add(new URL(script.src, base).href); } catch { /* malformed src, skip */ }
            }
        }

        for (const stylesheet of page.stylesheets || []) {
            if (stylesheet.href) {
                try { urls.add(new URL(stylesheet.href, base).href); } catch { /* malformed href, skip */ }
            }
        }

        for (const src of page.images?.sources || []) {
            try { urls.add(new URL(src, base).href); } catch { /* malformed src, skip */ }
        }
    }

    return [...urls];
}

async function fetchOneAsset(url) {
    try {
        const response = await httpClient.get(url, {
            responseType: "arraybuffer",
            maxContentLength: MAX_ASSET_BYTES
        });

        const hash = crypto.createHash("sha256").update(response.data).digest("hex");

        return {
            url,
            status: response.status,
            sizeBytes: response.data.length,
            hash,
            tooLarge: false,
            error: null
        };

    } catch (error) {
        if (/maxContentLength size.*exceeded/i.test(error.message || "")) {
            return { url, status: error.response?.status || null, sizeBytes: null, hash: null, tooLarge: true, error: null };
        }

        return {
            url,
            status: error.response?.status || null,
            sizeBytes: null,
            hash: null,
            tooLarge: false,
            error: error.message
        };
    }
}

// Fetches every unique script/stylesheet/image URL referenced across the
// whole site exactly once (deduped), with bounded concurrency. Returns a
// map keyed by URL so assetRules.js can read it without doing any I/O
// itself -- rules stay synchronous and side-effect-free.
async function checkAssets(websiteModel, { concurrency = 5 } = {}) {
    const urls = collectAssetUrls(websiteModel);

    console.log(`Checking ${urls.length} unique asset(s)...`);

    const results = await mapWithConcurrency(urls, concurrency, fetchOneAsset);

    const byUrl = {};
    results.forEach(result => { byUrl[result.url] = result; });

    return byUrl;
}

module.exports = { checkAssets, collectAssetUrls };
