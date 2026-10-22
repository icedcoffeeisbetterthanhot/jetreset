import { test, expect } from "@playwright/test";

test("daily dashboard is reachable from primary navigation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Daily dashboard" })
    .click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).toHaveTitle(/Daily dashboard/i);
  await expect(page.getByRole("heading", { level: 1, name: "Daily dashboard" })).toBeVisible();
});

test("daily dashboard returns not found for an invalid trip", async ({ page }) => {
  const response = await page.goto("/dashboard?trip=not-a-trip");
  expect(response?.status()).toBe(404);
});
