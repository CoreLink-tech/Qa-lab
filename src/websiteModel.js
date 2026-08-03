function createWebsiteModel(url) {

    return {
        schemaVersion: "1.0",

        url,

        scan: {
            startedAt: null,
            completedAt: null
        },

        homepage: {
            status: null,
            title: null,
            server: null,
            responseTime: null,
            error: null
        },

        pages: [],

        performance: {
            averageResponseTime: null,
            slowPages: 0
        },

        seo: {},

        security: {},

        accessibility: {},

        forms: {},

        screenshots: {},

        technologies: {},

        findings: [],

        summary: {
            pagesScanned: 0,
            issuesFound: 0,
            severity: {
                high: 0,
                medium: 0,
                low: 0
            }
        }
    };
}


module.exports = createWebsiteModel;
