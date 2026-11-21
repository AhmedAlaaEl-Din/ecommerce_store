import { expect, test } from "@playwright/test";

test.describe("mobile", () => {
  test("menu opens and closes with the keyboard, traps focus and restores it", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Open menu" });
    const menu = page.getByTestId("mobile-menu");

    // Reach the menu button with Tab (after the skip link) and open with Enter.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(menuButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

    // Focus stays inside the dialog: Shift+Tab from the first element wraps to the last.
    await page.keyboard.press("Shift+Tab");
    const insideAfterShiftTab = await menu.evaluate((el) => el.contains(document.activeElement));
    expect(insideAfterShiftTab).toBe(true);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    // Esc closes it and focus returns to the menu button.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    // Re-open with Space and close with the close button via keyboard.
    await page.keyboard.press("Space");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Enter"); // focused close button
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test("menu links navigate and close the menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByTestId("mobile-menu").getByRole("link", { name: "Stationery" }).click();
    await expect(page).toHaveURL(/category=stationery/);
    await expect(page.getByTestId("mobile-menu")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stationery");
  });

  test("filters live in a bottom sheet", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByTestId("sort-select")).toBeHidden();
    await page.getByTestId("open-filters").click();
    const sheet = page.getByTestId("filter-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radio", { name: "Bags" }).check();
    await sheet.getByRole("radio", { name: "Price: low to high" }).check();
    await page.getByTestId("apply-filters").click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/category=bags&sort=price-asc/);
    await expect(page.getByTestId("result-count")).toHaveText("6 products");
    await expect(page.getByTestId("open-filters")).toContainText("2");
  });

  test("add to cart and cart work on a phone, with no horizontal scroll", async ({ page }) => {
    await page.goto("/products/papyrus-zip-pouch");
    const add = page.getByTestId("add-to-cart");
    const box = await add.boundingBox();
    expect(box!.width).toBeGreaterThan(340); // full-width button
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await add.click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.getByTestId("cart-button").click();
    await expect(page.getByTestId("cart-line")).toHaveCount(1);

    for (const path of ["/", "/products", "/products/papyrus-zip-pouch", "/cart", "/nope"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });

  test("touch targets in the header and stepper are at least 44px", async ({ page }) => {
    await page.goto("/products/dune-ceramic-vase");
    for (const name of ["Open menu", "Search", "Increase quantity", "Decrease quantity"]) {
      const b = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(b!.width, name).toBeGreaterThanOrEqual(44);
      expect(b!.height, name).toBeGreaterThanOrEqual(44);
    }
    const cart = await page.getByTestId("cart-button").boundingBox();
    expect(cart!.height).toBeGreaterThanOrEqual(44);
  });
});
