const cheerio = require("cheerio");
const { httpClient } = require("./utils/httpClient");

// Fetches a single page and extracts everything downstream needs: the
// raw HTML (for normalizer.js to build the full model), and the raw,
// unresolved <a href> values (for the crawler to decide what to visit
// next). Used uniformly for every page at every crawl depth, not just
// the seed URL -- BFS crawling needs link-extraction from every page,
// not only the homepage.
async function fetchPage(url) {
    try {
        const start = Date.now();
        const response = await httpClient.get(url);
        const responseTime = Date.now() - start;

        const $ = cheerio.load(response.data);

        const rawLinks = $("a")
            .map((i, el) => $(el).attr("href"))
            .get()
            .filter(Boolean);

        return {
            url,
            status: response.status,
            responseTime,
            title: $("title").text().trim() || null,
            html: response.data,
            headers: response.headers,
            rawLinks
        };

    } catch (error) {
        return {
            url,
            status: error.response?.status || "Unknown",
            responseTime: null,
            title: null,
            html: "",
            headers: {},
            rawLinks: [],
            error: error.message
        };
    }
}

module.exports = { fetchPage };
