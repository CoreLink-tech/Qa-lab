function checkBrokenPages(websiteModel) {

    const findings = [];

    websiteModel.pages.forEach(page => {

        if (page.status !== 200) {

            findings.push({
                type: "Functionality",
                severity: "High",
                title: "Page Failed To Load",
                page: page.url,
                description:
                    `Page returned status ${page.status}`
            });

        }

    });

    return findings;
}


module.exports = {
    checkBrokenPages
};
