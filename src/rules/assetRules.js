function checkMissingAssets(websiteModel) {

    const findings = [];


    for (const page of websiteModel.pages) {


        if (!page.links) continue;


        for (const link of page.links) {


            if (
                !link.includes(".js") &&
                !link.includes(".css")
            ) {
                continue;
            }


            const assetExists = websiteModel.pages.some(
                p => p.url === link
            );


            if (!assetExists) {

                findings.push({

                    type: "Missing Asset",

                    severity: "Medium",

                    page: page.url,

                    details: `Possible missing asset: ${link}`

                });

            }

        }

    }


    return findings;

}


module.exports = {
    checkMissingAssets
};
