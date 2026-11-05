// Best-effort technology fingerprinting from signals already available
// during a normal page fetch: response headers, the meta generator tag,
// known script/stylesheet path fragments, and cookie names.
//
// This is deliberately a small, curated signature list, not an attempt
// at a comprehensive Wappalyzer-style database. Entries are only added
// when the signal is reasonably unambiguous (e.g. "/wp-content/" really
// does mean WordPress) rather than guessed from weak clues.

"use strict";

/**
 * Extract hostname from a resource URL/path. Uses the URL parser so
 * host checks are not based on incomplete substring matches (CodeQL).
 * @param {string} raw
 * @returns {string}
 */
function resourceHostname(raw) {
  if (typeof raw !== "string" || !raw) return "";
  try {
    // Absolute URL
    if (raw.includes("://") || raw.startsWith("//")) {
      const href = raw.startsWith("//") ? `https:${raw}` : raw;
      return new URL(href).hostname.toLowerCase();
    }
  } catch {
    /* fall through */
  }
  // Relative path — no host
  return "";
}

/**
 * True if any resource path's hostname equals or is a subdomain of host.
 * @param {string[]} paths
 * @param {string} host
 */
function hostInResources(paths, host) {
  const target = host.toLowerCase();
  for (const p of paths) {
    const h = resourceHostname(p);
    if (!h) continue;
    if (h === target || h.endsWith(`.${target}`)) return true;
  }
  return false;
}

/**
 * Path-fragment match on pathname only (after URL parse when absolute).
 * @param {string[]} paths
 * @param {(pathname: string) => boolean} pred
 */
function pathMatch(paths, pred) {
  for (const raw of paths) {
    if (typeof raw !== "string") continue;
    let pathname = raw;
    try {
      if (raw.includes("://") || raw.startsWith("//")) {
        const href = raw.startsWith("//") ? `https:${raw}` : raw;
        pathname = new URL(href).pathname;
      }
    } catch {
      pathname = raw;
    }
    if (pred(pathname)) return true;
  }
  return false;
}

const SIGNATURES = [
  {
    name: "WordPress",
    category: "CMS",
    test: (ctx) =>
      ctx.generator.toLowerCase().includes("wordpress") ||
      pathMatch(
        ctx.resourcePaths,
        (p) => p.includes("/wp-content/") || p.includes("/wp-includes/"),
      ),
  },
  {
    name: "Shopify",
    category: "E-commerce",
    test: (ctx) =>
      ctx.headers["x-shopify-stage"] !== undefined ||
      hostInResources(ctx.resourcePaths, "cdn.shopify.com") ||
      ctx.cookieNames.some(
        (c) => c.includes("_shopify_") || c === "cart_currency",
      ),
  },
  {
    name: "Wix",
    category: "Website Builder",
    test: (ctx) =>
      ctx.generator.toLowerCase().includes("wix") ||
      hostInResources(ctx.resourcePaths, "static.wixstatic.com"),
  },
  {
    name: "Squarespace",
    category: "Website Builder",
    test: (ctx) =>
      ctx.generator.toLowerCase().includes("squarespace") ||
      hostInResources(ctx.resourcePaths, "squarespace.com"),
  },
  {
    name: "Webflow",
    category: "Website Builder",
    test: (ctx) =>
      ctx.generator.toLowerCase().includes("webflow") ||
      hostInResources(ctx.resourcePaths, "website-files.com"),
  },
  {
    name: "Drupal",
    category: "CMS",
    test: (ctx) =>
      ctx.generator.toLowerCase().includes("drupal") ||
      String(ctx.headers["x-generator"] || "")
        .toLowerCase()
        .includes("drupal"),
  },
  {
    name: "jQuery",
    category: "JavaScript Library",
    test: (ctx) =>
      pathMatch(ctx.resourcePaths, (p) => p.toLowerCase().includes("jquery")),
  },
  {
    name: "Google Analytics / Tag Manager",
    category: "Analytics",
    test: (ctx) =>
      hostInResources(ctx.resourcePaths, "google-analytics.com") ||
      hostInResources(ctx.resourcePaths, "googletagmanager.com"),
  },
  {
    name: "Cloudflare",
    category: "CDN / Security",
    test: (ctx) =>
      ctx.headers["server"]?.toLowerCase() === "cloudflare" ||
      ctx.headers["cf-ray"] !== undefined,
  },
  {
    name: "PHP",
    category: "Language / Runtime",
    test: (ctx) =>
      String(ctx.headers["x-powered-by"] || "")
        .toLowerCase()
        .includes("php") ||
      ctx.cookieNames.some((c) => c.toUpperCase() === "PHPSESSID"),
  },
  {
    name: "ASP.NET",
    category: "Language / Runtime",
    test: (ctx) =>
      String(ctx.headers["x-powered-by"] || "")
        .toLowerCase()
        .includes("asp.net") ||
      ctx.headers["x-aspnet-version"] !== undefined ||
      ctx.cookieNames.some((c) => c.toUpperCase() === "ASP.NET_SESSIONID"),
  },
  {
    name: "Express / Node.js",
    category: "Language / Runtime",
    test: (ctx) =>
      String(ctx.headers["x-powered-by"] || "")
        .toLowerCase()
        .includes("express"),
  },
];

function detectTechnologies({ generator, resourcePaths, headers, cookieNames }) {
  const ctx = {
    generator: generator || "",
    resourcePaths: resourcePaths || [],
    headers: headers || {},
    cookieNames: cookieNames || [],
  };

  return SIGNATURES.filter((sig) => {
    try {
      return sig.test(ctx);
    } catch {
      return false;
    }
  }).map((sig) => ({ name: sig.name, category: sig.category }));
}

module.exports = { detectTechnologies };
