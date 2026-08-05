// Shared builders for tests so every rule test isn't hand-rolling a
// full page/websiteModel shape with a dozen fields it doesn't care about.

function makePage(overrides = {}) {
    return {
        url: "https://example.com/",
        status: 200,
        responseTime: 100,
        title: "Example",
        headers: {},
        headings: { h1: 1, h2: 0, h3: 0 },
        images: { total: 0, missingAlt: 0 },
        forms: { total: 0, inputs: 0, buttons: 0, fields: [] },
        links: [],
        meta: { description: null, viewport: null },
        ...overrides
    };
}

function makeModel(pages = []) {
    return {
        url: "https://example.com",
        pages
    };
}

module.exports = { makePage, makeModel };
