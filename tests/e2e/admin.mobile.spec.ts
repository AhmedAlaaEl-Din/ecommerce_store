import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "./support/admin";

test.use({ storageState: ADMIN_STATE });

test.describe("admin on a phone", () => {
  test("the sidebar becomes a drawer: opens, traps focus, closes with Esc and navigates", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: "Admin", exact: true })).toBeHidden();
    const button = page.getByTestId("admin-menu-button");
    await button.click();
    const drawer = page.getByTestId("admin-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Close admin menu" })).toBeFocused();
    // Tab cycles inside the drawer.
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await drawer.getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(drawer).toBeHidden();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("an order's detail page works on a phone", async ({ page }) => {
    await page.goto("/admin/orders?status=paid");
    await page.getByTestId("order-row").first().getByRole("link").click();
    await expect(page.getByTestId("order-line").first()).toBeVisible();
    await expect(page.getByTestId("timeline")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Customer" })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});
