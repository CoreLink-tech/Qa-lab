// Shared builders for tests so every rule test isn't hand-rolling a
// full page/websiteModel shape with a dozen fields it doesn't care about.
//
// Nested objects (headings, images, forms, meta) are merged rather than
// replaced wholesale, so a test overriding one sub-field (e.g. just
// meta.canonical) doesn't silently reset every other sub-field to
// undefined and trip unrelated findings.

function makePage(overrides = {}) {
    const defaults = {
        url: "https://example.com/",
        status: 200,
        responseTime: 100,
        title: "Example",
        headers: {},
        headings: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
        headingSequence: ["h1"],
        images: { total: 0, missingAlt: 0 },
        forms: { total: 0, inputs: 0, buttons: 0, fields: [], list: [] },
        links: [],
        meta: {
            description: null,
            viewport: null,
            canonical: null,
            robots: null,
            ogTitle: null,
            ogDescription: null,
            twitterCard: null
        },
        structuredDataCount: 0,
        lang: "en",
        labelFors: [],
        mixedContentCount: 0,
        htmlSize: 1000
    };

    return {
        ...defaults,
        ...overrides,
        headings: { ...defaults.headings, ...(overrides.headings || {}) },
        images: { ...defaults.images, ...(overrides.images || {}) },
        forms: { ...defaults.forms, ...(overrides.forms || {}) },
        meta: { ...defaults.meta, ...(overrides.meta || {}) }
    };
}

function makeModel(pages = []) {
    return {
        url: "https://example.com",
        pages
    };
}

module.exports = { makePage, makeModel };
