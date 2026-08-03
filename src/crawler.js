const axios = require("axios");
const cheerio = require("cheerio");
const { normalizeUrl, removeDuplicates } = require("./utils/urlNormalizer");

async function crawlWebsite(url) {
    try {
        console.log("Crawling:", url);

        const response = await axios.get(url);

        console.log("Crawler Status:", response.status);

        const $ = cheerio.load(response.data);

        const links = [];

        $("a").each((i, element) => {
            const href = $(element).attr("href");

            if (!href) return;

            const cleanUrl = normalizeUrl(url, href);

            if (cleanUrl) {
                links.push(cleanUrl);
            }
        });

        const uniqueLinks = removeDuplicates(links);

        console.log(`Crawler found ${uniqueLinks.length} links.`);

        return uniqueLinks;

    } catch (error) {

        console.error("\n===== CRAWLER ERROR =====");

        console.error("Message:", error.message);

        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("URL:", error.config.url);
        }

        console.error("=========================\n");

        return [];
    }
}

module.exports = {
    crawlWebsite
};
