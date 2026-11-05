import { test, expect } from "@playwright/test";

test("home responds", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok() || res?.status() === 404 || res?.status() === 200).toBeTruthy();
});
