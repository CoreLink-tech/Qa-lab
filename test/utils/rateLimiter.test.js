const test = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter } = require("../../src/utils/rateLimiter");

test("does not delay when minIntervalMs is 0", async () => {
    const wait = createRateLimiter(0);
    const start = Date.now();
    await wait();
    await wait();
    await wait();
    assert.ok(Date.now() - start < 20);
});

test("enforces a minimum gap between successive calls", async () => {
    const wait = createRateLimiter(50);
    const start = Date.now();
    await wait();
    await wait();
    await wait();
    const elapsed = Date.now() - start;
    // 3 calls with a 50ms floor between each -> at least ~100ms total
    // (first call is immediate, then two 50ms gaps).
    assert.ok(elapsed >= 90, `expected at least ~100ms, got ${elapsed}ms`);
});

test("concurrent callers still get spaced out correctly, not all at once", async () => {
    const wait = createRateLimiter(30);
    const timestamps = [];

    await Promise.all([1, 2, 3, 4].map(async () => {
        await wait();
        timestamps.push(Date.now());
    }));

    timestamps.sort((a, b) => a - b);
    for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i] - timestamps[i - 1];
        assert.ok(gap >= 25, `expected gap >= ~30ms between calls, got ${gap}ms`);
    }
});
