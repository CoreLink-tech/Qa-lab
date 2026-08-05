const cheerio = require("cheerio");
const { httpClient } = require("./utils/httpClient");
const { normalizeUrl, removeDuplicates } = require("./utils/urlNormalizer");

// Crawls the homepage once and returns both the page data for that fetch
// AND the discovered links, so callers don't need a second request just
// to get homepage data (that was the old scanner.js + crawler.js split).
async function crawlWebsite(url) {
    try {
        console.log("Crawling:", url);

        const start = Date.now();
        const response = await httpClient.get(url);
        const responseTime = Date.now() - start;

        console.log("Crawler Status:", response.status);

        const $ = cheerio.load(response.data);

        const homepage = {
            url,
            status: response.status,
            responseTime,
            title: $("title").text().trim() || null,
            html: response.data,
            headers: response.headers
        };

        const links = [];

        $("a").each((i, element) => {
            const href = $(element).attr("href");

            if (!href) return;

            const cleanUrl = normalizeUrl(url, href);

            if (cleanUrl) {
                links.push(cleanUrl);
            }
        });

        // Don't let the homepage show up twice: once as `homepage`, and
        // again as a link scanned separately just because the nav bar
        // links back to "/".
        const homepagePath = new URL(url).pathname + new URL(url).search;
        const uniqueLinks = removeDuplicates(links)
            .filter(link => link !== homepagePath);

        console.log(`Crawler found ${uniqueLinks.length} links.`);

        return { homepage, links: uniqueLinks };

    } catch (error) {

        console.error("\n===== CRAWLER ERROR =====");

        console.error("Message:", error.message);

        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("URL:", error.config.url);
        }

        console.error("=========================\n");

        return {
            homepage: {
                url,
                status: error.response?.status || "Unknown",
                responseTime: null,
                title: null,
                html: "",
                headers: {},
                error: error.message
            },
            links: []
        };
    }
}

module.exports = {
    crawlWebsite
};
