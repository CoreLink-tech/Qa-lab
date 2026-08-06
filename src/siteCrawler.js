const { fetchPage } = require("./pageFetcher");
const { normalizeUrl } = require("./utils/urlNormalizer");
const { mapWithConcurrency } = require("./utils/concurrency");
const { fetchRobotsRules, isAllowed } = require("./robotsTxt");
const { createRateLimiter } = require("./utils/rateLimiter");
const { discoverSitemapUrls } = require("./sitemapParser");

function matchesAny(patterns, path) {
    return patterns.some(pattern => pattern.test(path));
}

// Breadth-first crawl: fetches the seed URL, then all its links (depth 1),
// then all of THEIR links (depth 2), and so on up to maxDepth, or until
// maxPages total pages have been fetched -- whichever comes first.
//
// Duplicate URLs are tracked globally across the whole crawl (a `visited`
// set spanning every depth level), not just within a single page's link
// list the way the old single-level crawler worked.
//
// robots.txt is respected for DISCOVERED links only, not the seed URL
// itself -- if someone explicitly points this at a URL, that's an
// explicit request to scan it, not something robots.txt should override.
async function crawlSite(startUrl, options = {}) {
    const {
        maxDepth = 2,
        maxPages = 100,
        concurrency = 5,
        respectRobots = true,
        delayMs = 0,
        useSitemap = false,
        includePatterns = [],
        excludePatterns = []
    } = options;

    // Sitemap discovery can use robots.txt's Sitemap: directive, so fetch
    // robots.txt whenever either feature needs it -- once, shared by both.
    const needsRobotsTxt = respectRobots || useSitemap;
    const robotsRules = needsRobotsTxt ? await fetchRobotsRules(startUrl) : null;

    const sitemapUrls = useSitemap ? await discoverSitemapUrls(startUrl, robotsRules) : [];

    const wait = createRateLimiter(delayMs);

    function passesFilters(path) {
        if (excludePatterns.length > 0 && matchesAny(excludePatterns, path)) return false;
        if (includePatterns.length > 0 && !matchesAny(includePatterns, path)) return false;
        return true;
    }

    const startPath = new URL(startUrl).pathname + new URL(startUrl).search;

    const visited = new Set([startPath]);
    const pages = [];
    let currentLevel = [{ url: startUrl, depth: 0 }];
    let truncated = false;
    let robotsBlockedCount = 0;

    while (currentLevel.length > 0 && pages.length < maxPages) {

        const remainingBudget = maxPages - pages.length;
        const levelToFetch = currentLevel.slice(0, remainingBudget);

        if (levelToFetch.length < currentLevel.length) {
            truncated = true;
        }

        console.log(`Crawling depth ${levelToFetch[0].depth}: ${levelToFetch.length} page(s)...`);

        const fetchedLevel = await mapWithConcurrency(levelToFetch, concurrency, async (item) => {
            await wait();
            const page = await fetchPage(item.url);
            return { ...page, depth: item.depth };
        });

        pages.push(...fetchedLevel);

        const nextLevel = [];

        const addCandidate = (resolvedPath, nextDepth) => {
            if (nextLevel.length >= maxPages) return;
            if (!resolvedPath) return;
            if (visited.has(resolvedPath)) return;
            if (!passesFilters(resolvedPath)) return;

            if (respectRobots && !isAllowed(robotsRules, resolvedPath)) {
                robotsBlockedCount++;
                visited.add(resolvedPath);
                return;
            }

            visited.add(resolvedPath);
            nextLevel.push({ url: new URL(resolvedPath, startUrl).href, depth: nextDepth });
        };

        for (const page of fetchedLevel) {

            if (page.depth >= maxDepth) continue;
            if (nextLevel.length >= maxPages) break;

            for (const rawLink of page.rawLinks) {
                if (nextLevel.length >= maxPages) break;
                addCandidate(normalizeUrl(page.url, rawLink), page.depth + 1);
            }
        }

        // Fold sitemap-discovered URLs into the depth-1 batch, alongside
        // whatever the homepage's own links produced. Only relevant right
        // after the seed page (depth 0) was fetched.
        if (levelToFetch[0].depth === 0 && sitemapUrls.length > 0 && maxDepth >= 1) {
            for (const sitemapUrl of sitemapUrls) {
                if (nextLevel.length >= maxPages) break;
                addCandidate(normalizeUrl(startUrl, sitemapUrl), 1);
            }
        }

        currentLevel = nextLevel;
    }

    if (currentLevel.length > 0) {
        truncated = true;
    }

    return { pages, truncated, robotsBlockedCount };
}

module.exports = { crawlSite };
