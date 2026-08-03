function checkBrokenLinks(websiteModel) {

    const findings = [];

    for (const page of websiteModel.pages) {

        if (page.status >= 400) {

            findings.push({

                type: "Broken Link",
                category: "Functional",
                severity: "High",
                page: page.url,
                details: `Page returned HTTP ${page.status}`

            });

        }

    }

    return findings;

}

module.exports = {
    checkBrokenLinks
};
