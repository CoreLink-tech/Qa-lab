function createWebsiteModel(url) {

    return {
        url,

        homepage: {
            status: null,
            responseTime: null,
            server: null,
            title: null,
            error: null
        },

        pages: [],

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

module.exports = { createWebsiteModel };
