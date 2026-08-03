const axios = require("axios");
const cheerio = require("cheerio");


async function scanPage(baseUrl, path) {

    try {

        const url = new URL(path, baseUrl).href;

        const start = Date.now();

        const response = await axios.get(url);

        const responseTime = Date.now() - start;


        const $ = cheerio.load(response.data);


        return {

            url,

            status: response.status,

            responseTime,

            title: $("title").text().trim() || null,

            html: response.data,

            headers: response.headers

        };


    } catch (error) {


        return {

            url: new URL(path, baseUrl).href,

            status: error.response?.status || 500,

            error: error.message,

            html: "",

            headers: {}

        };

    }

}


module.exports = {
    scanPage
};
