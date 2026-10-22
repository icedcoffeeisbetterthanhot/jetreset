import { test, expect } from "@playwright/test";

test("flight status page is reachable from primary navigation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Flight Status" })
    .click();

  await expect(page).toHaveURL(/\/flight-status$/);
  await expect(page).toHaveTitle(/Flight Status/i);
  await expect(page.getByRole("heading", { level: 1, name: "Flight Status" })).toBeVisible();
});

test("flight status page returns not found for an invalid trip", async ({ page }) => {
  const response = await page.goto("/flight-status?trip=0");
  expect(response?.status()).toBe(404);
});
