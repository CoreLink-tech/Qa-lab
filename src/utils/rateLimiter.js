// Enforces a minimum interval between successive requests, independent
// of the concurrency pool. With concurrency=5 and a delay of 200ms,
// this still caps the overall request rate rather than letting 5
// requests fire simultaneously every round.
function createRateLimiter(minIntervalMs = 0) {
    let nextAllowedTime = 0;

    return async function wait() {
        if (minIntervalMs <= 0) return;

        const now = Date.now();
        const waitFor = Math.max(0, nextAllowedTime - now);

        // Reserve the next slot before awaiting, so concurrent callers
        // queue up correctly instead of all reading the same stale
        // nextAllowedTime.
        nextAllowedTime = Math.max(now, nextAllowedTime) + minIntervalMs;

        if (waitFor > 0) {
            await new Promise(resolve => setTimeout(resolve, waitFor));
        }
    };
}

module.exports = { createRateLimiter };
