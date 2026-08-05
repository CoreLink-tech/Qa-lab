// Runs `mapper` over `items` with at most `limit` in flight at once.
// Results are returned in the same order as `items`, regardless of which
// one finishes first — matters for deterministic report output when
// scanning the same site twice.
async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex++;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }

    const workerCount = Math.max(1, Math.min(limit, items.length));
    const workers = Array.from({ length: workerCount }, () => worker());

    await Promise.all(workers);

    return results;
}

module.exports = { mapWithConcurrency };
