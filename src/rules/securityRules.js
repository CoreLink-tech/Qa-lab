function checkSecurityHeaders(websiteModel) {

    const findings = [];

    for (const page of websiteModel.pages) {

        if (!page.headers) continue;


        const headers = page.headers;


        if (!headers["content-security-policy"]) {

            findings.push({

                type: "Security Header",

                severity: "Medium",

                page: page.url,

                details: "Missing Content-Security-Policy header"

            });

        }


        if (!headers["x-frame-options"]) {

            findings.push({

                type: "Security Header",

                severity: "Low",

                page: page.url,

                details: "Missing X-Frame-Options header"

            });

        }


        if (!headers["strict-transport-security"]) {

            findings.push({

                type: "Security Header",

                severity: "Medium",

                page: page.url,

                details: "Missing Strict-Transport-Security header"

            });

        }


        if (!headers["x-content-type-options"]) {

            findings.push({

                type: "Security Header",

                severity: "Low",

                page: page.url,

                details: "Missing X-Content-Type-Options header"

            });

        }

    }


    return findings;

}


module.exports = {
    checkSecurityHeaders
};
