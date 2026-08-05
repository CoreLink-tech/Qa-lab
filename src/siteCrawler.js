const { fetchPage } = require("./pageFetcher");
const { normalizeUrl } = require("./utils/urlNormalizer");
const { mapWithConcurrency } = require("./utils/concurrency");
const { fetchRobotsRules, isAllowed } = require("./robotsTxt");
const { createRateLimiter } = require("./utils/rateLimiter");

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
        delayMs = 0
    } = options;

    const robotsRules = respectRobots ? await fetchRobotsRules(startUrl) : null;
    const wait = createRateLimiter(delayMs);

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

        for (const page of fetchedLevel) {

            if (page.depth >= maxDepth) continue;
            if (nextLevel.length >= maxPages) break;

            for (const rawLink of page.rawLinks) {

                if (nextLevel.length >= maxPages) break;

                const resolvedPath = normalizeUrl(page.url, rawLink);

                if (!resolvedPath) continue;
                if (visited.has(resolvedPath)) continue;

                if (respectRobots && !isAllowed(robotsRules, resolvedPath)) {
                    robotsBlockedCount++;
                    visited.add(resolvedPath);
                    continue;
                }

                visited.add(resolvedPath);

                const resolvedUrl = new URL(resolvedPath, startUrl).href;
                nextLevel.push({ url: resolvedUrl, depth: page.depth + 1 });
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
