const cheerio = require("cheerio");


function normalizePage(page, html) {

    const $ = cheerio.load(html);


    const headings = {
        h1: $("h1").length,
        h2: $("h2").length,
        h3: $("h3").length
    };


    const images = {
        total: $("img").length,
        missingAlt: $("img:not([alt]), img[alt='']").length
    };


    const links = [];

    $("a").each((i, element) => {

        const href = $(element).attr("href");

        if (href) {
            links.push(href);
        }

    });


    const forms = {

        total: $("form").length,

        inputs: $("input").length,

        buttons: $("button").length,

        fields: $("input").map((i, element) => ({

            type: $(element).attr("type") || "text",

            name: $(element).attr("name") || null,

            autocomplete: $(element).attr("autocomplete") || null

        })).get()

    };


    const meta = {

        description:
            $("meta[name='description']").attr("content") || null,

        viewport:
            $("meta[name='viewport']").attr("content") || null

    };


    return {

        ...page,

        headings,

        images,

        links,

        forms,

        meta

    };

}


module.exports = {
    normalizePage
};
