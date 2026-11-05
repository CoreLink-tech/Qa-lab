// Best-effort technology fingerprinting from response headers, meta
// generator, resource URLs, and cookie names.

"use strict";

/**
 * @param {string} raw
 * @returns {{ host: string, pathname: string }}
 */
function parseResource(raw) {
  if (typeof raw !== "string" || !raw) {
    return { host: "", pathname: "" };
  }
  try {
    if (raw.includes("://") || raw.startsWith("//")) {
      const href = raw.startsWith("//") ? `https:${raw}` : raw;
      const u = new URL(href);
      return {
        host: u.hostname.toLowerCase(),
        pathname: u.pathname || "/",
      };
    }
  } catch {
    /* ignore */
  }
  // Relative path — treat entire string as pathname
  return { host: "", pathname: raw.startsWith("/") ? raw : `/${raw}` };
}

/** @param {string} host @param {string} target */
function hostEqualsOrSubdomain(host, target) {
  if (!host || !target) return false;
  const h = host.toLowerCase();
  const t = target.toLowerCase();
  return h === t || h.endsWith("." + t);
}

/** @param {string} pathname @param {string} segment */
function pathHasSegment(pathname, segment) {
  // Match /segment/ or /segment at end without substring tricks on full URLs
  const p = pathname.toLowerCase();
  const s = segment.toLowerCase();
  const parts = p.split("/").filter(Boolean);
  return parts.some((part) => part === s || part.startsWith(s + "."));
}

/** @param {string[]} paths @param {string} host */
function hostInResources(paths, host) {
  for (const raw of paths) {
    const { host: h } = parseResource(raw);
    if (hostEqualsOrSubdomain(h, host)) return true;
  }
  return false;
}

/** @param {string[]} paths @param {string} segment */
function segmentInResources(paths, segment) {
  for (const raw of paths) {
    const { pathname } = parseResource(raw);
    if (pathHasSegment(pathname, segment)) return true;
  }
  return false;
}

/** @param {string[]} paths @param {string} needle in a path part */
function pathPartContains(paths, needle) {
  const n = needle.toLowerCase();
  for (const raw of paths) {
    const { pathname } = parseResource(raw);
    for (const part of pathname.toLowerCase().split("/").filter(Boolean)) {
      if (part === n || part.startsWith(n + ".") || part.startsWith(n + "-") || part.startsWith(n + "_")) {
        return true;
      }
    }
  }
  return false;
}

const SIGNATURES = [
  {
    name: "WordPress",
    category: "CMS",
    test: (ctx) =>
      ctx.generator.toLowerCase().indexOf("wordpress") !== -1 ||
      segmentInResources(ctx.resourcePaths, "wp-content") ||
      segmentInResources(ctx.resourcePaths, "wp-includes"),
  },
  {
    name: "Shopify",
    category: "E-commerce",
    test: (ctx) =>
      ctx.headers["x-shopify-stage"] !== undefined ||
      hostInResources(ctx.resourcePaths, "cdn.shopify.com") ||
      ctx.cookieNames.some(
        (c) => c.indexOf("_shopify_") !== -1 || c === "cart_currency",
      ),
  },
  {
    name: "Wix",
    category: "Website Builder",
    test: (ctx) =>
      ctx.generator.toLowerCase().indexOf("wix") !== -1 ||
      hostInResources(ctx.resourcePaths, "static.wixstatic.com"),
  },
  {
    name: "Squarespace",
    category: "Website Builder",
    test: (ctx) =>
      ctx.generator.toLowerCase().indexOf("squarespace") !== -1 ||
      hostInResources(ctx.resourcePaths, "squarespace.com"),
  },
  {
    name: "Webflow",
    category: "Website Builder",
    test: (ctx) =>
      ctx.generator.toLowerCase().indexOf("webflow") !== -1 ||
      hostInResources(ctx.resourcePaths, "website-files.com"),
  },
  {
    name: "Drupal",
    category: "CMS",
    test: (ctx) =>
      ctx.generator.toLowerCase().indexOf("drupal") !== -1 ||
      String(ctx.headers["x-generator"] || "")
        .toLowerCase()
        .indexOf("drupal") !== -1,
  },
  {
    name: "jQuery",
    category: "JavaScript Library",
    test: (ctx) => pathPartContains(ctx.resourcePaths, "jquery"),
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
      String(ctx.headers["server"] || "").toLowerCase() === "cloudflare" ||
      ctx.headers["cf-ray"] !== undefined,
  },
  {
    name: "PHP",
    category: "Language / Runtime",
    test: (ctx) => {
      const powered = String(ctx.headers["x-powered-by"] || "").toLowerCase();
      // Token match on header product list, not URL sanitization
      const products = powered.split(/\s+/);
      const isPhp = products.some(
        (tok) => tok === "php" || tok.startsWith("php/"),
      );
      return (
        isPhp || ctx.cookieNames.some((c) => c.toUpperCase() === "PHPSESSID")
      );
    },
  },
  {
    name: "ASP.NET",
    category: "Language / Runtime",
    test: (ctx) => {
      const powered = String(ctx.headers["x-powered-by"] || "").toLowerCase();
      const products = powered.split(/[\s,]+/);
      const isAsp = products.some(
        (tok) => tok === "asp.net" || tok.startsWith("asp.net"),
      );
      return (
        isAsp ||
        ctx.headers["x-aspnet-version"] !== undefined ||
        ctx.cookieNames.some((c) => c.toUpperCase() === "ASP.NET_SESSIONID")
      );
    },
  },
  {
    name: "Express / Node.js",
    category: "Language / Runtime",
    test: (ctx) => {
      const powered = String(ctx.headers["x-powered-by"] || "").toLowerCase();
      const products = powered.split(/[\s,]+/);
      return products.some((tok) => tok === "express");
    },
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
