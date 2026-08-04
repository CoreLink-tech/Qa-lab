function createWebsiteModel(url) {
    return {
        schemaVersion: "1.0",

        url,
        timestamp: new Date().toISOString(),

        pages: [],
        totalPages: 0,

        findings: [],
        recommendations: [],
        score: 0,

        summary: {
            pagesScanned: 0,
            issuesFound: 0,
            severity: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            }
        }
    };
}

module.exports = { createWebsiteModel };
