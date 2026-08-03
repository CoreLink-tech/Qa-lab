function checkHeadings(websiteModel) {

    const issues = [];

    websiteModel.pages.forEach(page => {

        const h1Count = page.headings?.h1 || 0;


        if (h1Count === 0) {

            issues.push({
                type: "SEO",
                severity: "Low",
                page: page.url,
                details: "Page does not contain an H1 heading"
            });

        }


        if (h1Count > 1) {

            issues.push({
                type: "SEO",
                severity: "Medium",
                page: page.url,
                details: `Page contains ${h1Count} H1 headings`
            });

        }

    });


    return issues;

}


module.exports = {
    checkHeadings
};
