const cheerio = require("cheerio");
const { httpClient } = require("./utils/httpClient");

// Sitemaps can list thousands of URLs; cap what we'll actually use so a
// large sitemap doesn't silently override --max-pages by a huge margin.
const MAX_SITEMAP_URLS = 500;

// Sitemap index files point to sub-sitemaps rather than listing URLs
// directly. depth guards against a pathological/cyclic index chain --
// one level of indirection covers the realistic case.
async function fetchSitemapUrls(sitemapUrl, depth = 0) {
    if (depth > 1) return [];

    try {
        const response = await httpClient.get(sitemapUrl);
        const $ = cheerio.load(response.data, { xmlMode: true });

        const subSitemaps = $("sitemapindex > sitemap > loc")
            .map((i, el) => $(el).text().trim())
            .get();

        if (subSitemaps.length > 0) {
            const results = await Promise.all(
                subSitemaps.slice(0, 10).map(subUrl => fetchSitemapUrls(subUrl, depth + 1))
            );
            return results.flat().slice(0, MAX_SITEMAP_URLS);
        }

        const urls = $("urlset > url > loc")
            .map((i, el) => $(el).text().trim())
            .get();

        return urls.slice(0, MAX_SITEMAP_URLS);

    } catch {
        return [];
    }
}

// Tries robots.txt-advertised Sitemap: URLs first (the standard way a
// site announces its sitemap), then falls back to the conventional
// /sitemap.xml location.
async function discoverSitemapUrls(startUrl, robotsRules) {
    const candidates = [
        ...(robotsRules?.sitemaps || []),
        new URL("/sitemap.xml", startUrl).href
    ];

    for (const candidate of candidates) {
        const urls = await fetchSitemapUrls(candidate);
        if (urls.length > 0) {
            return urls;
        }
    }

    return [];
}

module.exports = { discoverSitemapUrls, fetchSitemapUrls };
