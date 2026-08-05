const test = require("node:test");
const assert = require("node:assert/strict");
const { mapWithConcurrency } = require("../../src/utils/concurrency");

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test("returns results in original item order, regardless of completion order", async () => {
    // item 0 finishes LAST (100ms), item 4 finishes FIRST (5ms) --
    // if order weren't preserved, this would catch it immediately.
    const delays = [100, 80, 60, 40, 5];

    const results = await mapWithConcurrency(delays, 5, async (ms, i) => {
        await delay(ms);
        return i;
    });

    assert.deepEqual(results, [0, 1, 2, 3, 4]);
});

test("never runs more than `limit` mappers concurrently", async () => {
    let current = 0;
    let max = 0;

    const items = Array.from({ length: 10 });

    await mapWithConcurrency(items, 3, async () => {
        current++;
        max = Math.max(max, current);
        await delay(20);
        current--;
    });

    assert.ok(max <= 3, `expected max concurrency <= 3, saw ${max}`);
});

test("handles an empty items array without hanging or throwing", async () => {
    const results = await mapWithConcurrency([], 5, async () => "unused");
    assert.deepEqual(results, []);
});

test("limit larger than item count just runs everything at once", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 100, async n => n * 2);
    assert.deepEqual(results, [2, 4, 6]);
});
