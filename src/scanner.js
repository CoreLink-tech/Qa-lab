const axios = require("axios");
const cheerio = require("cheerio");

async function scanWebsite(url) {
    try {
        const start = Date.now();

        const response = await axios.get(url);

        const $ = cheerio.load(response.data);
        const title = $("title").text().trim();

        const end = Date.now();
        const responseTime = end - start;

        return {
            url,
            status: response.status,
            responseTime,
            server: response.headers.server || "Unknown",
            title: title || "No title found"
        };

    } catch (error) {
        return {
            url,
            status: error.response?.status || "Unknown",
            error: error.message
        };
    }
}

module.exports = { scanWebsite };
