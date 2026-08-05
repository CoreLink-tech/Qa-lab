const cheerio = require("cheerio");
const { httpClient } = require("./utils/httpClient");

async function scanPage(baseUrl, path) {

    try {

        const url = new URL(path, baseUrl).href;

        const start = Date.now();

        const response = await httpClient.get(url);

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
