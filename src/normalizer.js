const cheerio = require("cheerio");
const { parseCookies } = require("./utils/cookieParser");
const { detectTechnologies } = require("./utils/technologyDetection");

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];
const CSRF_NAME_PATTERN = /csrf|_token|authenticity_token/i;

function normalizePage(page, html) {

    const $ = cheerio.load(html);

    const headings = {
        h1: $("h1").length,
        h2: $("h2").length,
        h3: $("h3").length,
        h4: $("h4").length,
        h5: $("h5").length,
        h6: $("h6").length
    };

    // Actual DOM order of heading tags, not just counts -- counts alone
    // can't tell you a page jumped from h2 straight to h4.
    const headingSequence = $(HEADING_TAGS.join(","))
        .map((i, el) => el.tagName.toLowerCase())
        .get();

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

    // Flat aggregate fields, kept exactly as before -- FORM001/FORM002
    // and their tests depend on this shape.
    const fields = $("input").map((i, element) => ({
        type: $(element).attr("type") || "text",
        name: $(element).attr("name") || null,
        id: $(element).attr("id") || null,
        required: $(element).attr("required") !== undefined,
        autocomplete: $(element).attr("autocomplete") || null,
        ariaLabel: $(element).attr("aria-label") || null,
        ariaLabelledby: $(element).attr("aria-labelledby") || null,
        minlength: $(element).attr("minlength") || null,
        pattern: $(element).attr("pattern") || null,
        accept: $(element).attr("accept") || null
    })).get();

    // New: per-form structure, additive alongside the flat fields above.
    // Needed for checks that require knowing which fields belong to
    // which form (CSRF token presence, form method, file uploads).
    const formsList = $("form").map((i, formEl) => {
        const $form = $(formEl);

        const formFields = $form.find("input").map((j, inputEl) => ({
            type: $(inputEl).attr("type") || "text",
            name: $(inputEl).attr("name") || null,
            id: $(inputEl).attr("id") || null,
            required: $(inputEl).attr("required") !== undefined,
            autocomplete: $(inputEl).attr("autocomplete") || null
        })).get();

        const hasCSRFToken = formFields.some(
            field => field.type === "hidden" && field.name && CSRF_NAME_PATTERN.test(field.name)
        );

        return {
            method: ($form.attr("method") || "get").toLowerCase(),
            action: $form.attr("action") || null,
            hasFileUpload: $form.find("input[type='file']").length > 0,
            hasCSRFToken,
            fields: formFields
        };
    }).get();

    const forms = {
        total: $("form").length,
        inputs: $("input").length,
        buttons: $("button").length,
        fields,
        list: formsList
    };

    const meta = {
        description: $("meta[name='description']").attr("content") || null,
        viewport: $("meta[name='viewport']").attr("content") || null,
        canonical: $("link[rel='canonical']").attr("href") || null,
        robots: $("meta[name='robots']").attr("content") || null,
        ogTitle: $("meta[property='og:title']").attr("content") || null,
        ogDescription: $("meta[property='og:description']").attr("content") || null,
        twitterCard: $("meta[name='twitter:card']").attr("content") || null
    };

    const structuredDataCount = $("script[type='application/ld+json']").length;

    const lang = $("html").attr("lang") || null;

    const labelFors = $("label[for]")
        .map((i, el) => $(el).attr("for"))
        .get();

    // Mixed content: count of explicit http:// resource references on a
    // page that was itself loaded over https.
    let mixedContentCount = 0;
    if (page.url && page.url.startsWith("https://")) {
        mixedContentCount = $("img[src^='http://'], script[src^='http://'], link[href^='http://']").length;
    }

    const htmlSize = Buffer.byteLength(html || "", "utf8");

    // Real resource lists, not just <a> links -- needed for accurate
    // asset checks and render-blocking-script detection.
    const scripts = $("script").map((i, el) => {
        const $el = $(el);
        const src = $el.attr("src") || null;
        return {
            src,
            inline: !src,
            location: $el.parents("head").length > 0 ? "head" : "body",
            async: $el.attr("async") !== undefined,
            defer: $el.attr("defer") !== undefined
        };
    }).get();

    const stylesheets = $("link[rel='stylesheet']").map((i, el) => ({
        href: $(el).attr("href") || null
    })).get();

    const cookies = parseCookies(page.headers?.["set-cookie"]);

    const technologies = detectTechnologies({
        generator: $("meta[name='generator']").attr("content") || "",
        resourcePaths: [
            ...scripts.map(s => s.src).filter(Boolean),
            ...stylesheets.map(s => s.href).filter(Boolean)
        ],
        headers: page.headers || {},
        cookieNames: cookies.map(c => c.name)
    });

    return {
        ...page,
        headings,
        headingSequence,
        images,
        links,
        forms,
        meta,
        structuredDataCount,
        lang,
        labelFors,
        mixedContentCount,
        htmlSize,
        scripts,
        stylesheets,
        cookies,
        technologies
    };
}

module.exports = {
    normalizePage
};
