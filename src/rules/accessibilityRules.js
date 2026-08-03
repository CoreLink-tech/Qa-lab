
function checkImages(websiteModel) {

    const issues = [];

    websiteModel.pages.forEach(page => {

        const missingAlt = page.images?.missingAlt || 0;


        if (missingAlt > 0) {

            issues.push({
                type: "Accessibility",
                severity: "Low",
                page: page.url,
                details: `${missingAlt} images do not have alt attributes`
            });

        }

    });


    return issues;
}


module.exports = {
    checkImages
};
