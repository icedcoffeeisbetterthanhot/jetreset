import { test, expect } from "@playwright/test";

test("home page has JetReset title and content", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/JetReset/i);
  await expect(
    page.getByRole("heading", {
      name: /Recover from jet lag with calm, practical guidance/i,
    }),
  ).toBeVisible();
});
