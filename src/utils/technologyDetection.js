// Best-effort technology fingerprinting from signals already available
// during a normal page fetch: response headers, the meta generator tag,
// known script/stylesheet path fragments, and cookie names.
//
// This is deliberately a small, curated signature list, not an attempt
// at a comprehensive Wappalyzer-style database. Entries are only added
// when the signal is reasonably unambiguous (e.g. "/wp-content/" really
// does mean WordPress) rather than guessed from weak clues.

const SIGNATURES = [
    {
        name: "WordPress",
        category: "CMS",
        test: (ctx) =>
            /wordpress/i.test(ctx.generator) ||
            ctx.resourcePaths.some(p => /\/wp-content\/|\/wp-includes\//.test(p))
    },
    {
        name: "Shopify",
        category: "E-commerce",
        test: (ctx) =>
            ctx.headers["x-shopify-stage"] !== undefined ||
            ctx.resourcePaths.some(p => /cdn\.shopify\.com/.test(p)) ||
            ctx.cookieNames.some(c => /_shopify_|cart_currency/i.test(c))
    },
    {
        name: "Wix",
        category: "Website Builder",
        test: (ctx) =>
            /wix/i.test(ctx.generator) ||
            ctx.resourcePaths.some(p => /static\.wixstatic\.com/.test(p))
    },
    {
        name: "Squarespace",
        category: "Website Builder",
        test: (ctx) =>
            /squarespace/i.test(ctx.generator) ||
            ctx.resourcePaths.some(p => /squarespace\.com/.test(p))
    },
    {
        name: "Webflow",
        category: "Website Builder",
        test: (ctx) =>
            /webflow/i.test(ctx.generator) ||
            ctx.resourcePaths.some(p => /website-files\.com/.test(p))
    },
    {
        name: "Drupal",
        category: "CMS",
        test: (ctx) => /drupal/i.test(ctx.generator) || ctx.headers["x-generator"]?.toLowerCase().includes("drupal")
    },
    {
        name: "jQuery",
        category: "JavaScript Library",
        test: (ctx) => ctx.resourcePaths.some(p => /jquery/i.test(p))
    },
    {
        name: "Google Analytics / Tag Manager",
        category: "Analytics",
        test: (ctx) => ctx.resourcePaths.some(p => /google-analytics\.com|googletagmanager\.com/.test(p))
    },
    {
        name: "Cloudflare",
        category: "CDN / Security",
        test: (ctx) =>
            ctx.headers["server"]?.toLowerCase() === "cloudflare" ||
            ctx.headers["cf-ray"] !== undefined
    },
    {
        name: "PHP",
        category: "Language / Runtime",
        test: (ctx) =>
            ctx.headers["x-powered-by"]?.toLowerCase().includes("php") ||
            ctx.cookieNames.some(c => c.toUpperCase() === "PHPSESSID")
    },
    {
        name: "ASP.NET",
        category: "Language / Runtime",
        test: (ctx) =>
            ctx.headers["x-powered-by"]?.toLowerCase().includes("asp.net") ||
            ctx.headers["x-aspnet-version"] !== undefined ||
            ctx.cookieNames.some(c => c.toUpperCase() === "ASP.NET_SESSIONID")
    },
    {
        name: "Express / Node.js",
        category: "Language / Runtime",
        test: (ctx) => ctx.headers["x-powered-by"]?.toLowerCase().includes("express")
    }
];

function detectTechnologies({ generator, resourcePaths, headers, cookieNames }) {
    const ctx = {
        generator: generator || "",
        resourcePaths: resourcePaths || [],
        headers: headers || {},
        cookieNames: cookieNames || []
    };

    return SIGNATURES
        .filter(sig => {
            try {
                return sig.test(ctx);
            } catch {
                // A malformed header value shouldn't ever break a scan.
                return false;
            }
        })
        .map(sig => ({ name: sig.name, category: sig.category }));
}

module.exports = { detectTechnologies };
