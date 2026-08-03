function checkSlowPages(websiteModel) {
    const findings = [];

    websiteModel.pages.forEach(page => {

        if (page.responseTime > 5000) {

            findings.push({
                type: "Performance",
                title: "Very slow page response",
                severity: "High",
                page: page.url,
                details: `Page response time is ${page.responseTime} ms.`,
                recommendation: "Reduce server response time to under 2 seconds."
            });

        } else if (page.responseTime > 2000) {

            findings.push({
                type: "Performance",
                title: "Slow page response",
                severity: "Medium",
                page: page.url,
                details: `Page response time is ${page.responseTime} ms.`,
                recommendation: "Optimize backend processing, caching, and database queries."
            });

        }

    });

    return findings;
}

module.exports = {
    checkSlowPages
};
