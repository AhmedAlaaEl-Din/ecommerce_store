import { expect, test } from "@playwright/test";

test.describe("shopping journey", () => {
  test("browse → filter → search → sort → product → cart → persist → remove/undo → empty", async ({
    page,
  }) => {
    // Home
    await page.goto("/");
    await expect(page).toHaveTitle(/Nile Goods/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Well-made things");
    await expect(page.getByTestId("featured-row").getByTestId("product-card")).toHaveCount(4);
    await expect(page.getByTestId("sale-row").getByTestId("product-card")).toHaveCount(4);

    // Browse into the catalog
    await page.getByRole("link", { name: "Shop the collection" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByTestId("result-count")).toHaveText("Showing 1–12 of 24 products");
    await expect(page.getByTestId("product-card")).toHaveCount(12);

    // Pagination keeps state in the URL
    await page.getByRole("link", { name: "Page 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("result-count")).toHaveText("Showing 13–24 of 24 products");

    // Filter by category (resets to page 1)
    await page
      .getByRole("group", { name: "Filter by category" })
      .getByRole("button", { name: "Kitchen" })
      .click();
    await expect(page).toHaveURL(/\/products\?category=kitchen$/);
    await expect(page.getByTestId("result-count")).toHaveText("6 products");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kitchen");

    // Search within the category
    await page.getByTestId("catalog-search").fill("kettle");
    await page.getByTestId("catalog-search").press("Enter");
    await expect(page).toHaveURL(/category=kitchen&q=kettle/);
    await expect(page.getByTestId("product-card")).toHaveCount(1);

    // Clear search, then sort by price high → low
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page).toHaveURL(/\/products\?category=kitchen$/);
    await page.getByTestId("sort-select").selectOption("price-desc");
    await expect(page).toHaveURL(/category=kitchen&sort=price-desc/);
    const names = page.getByTestId("product-card").getByRole("heading");
    await expect(names.first()).toHaveText("Delta Pour-Over Kettle");
    await expect(names.last()).toHaveText("Basalt Stoneware Mug");

    // Sort low → high
    await page.getByTestId("sort-select").selectOption("price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(names.first()).toHaveText("Basalt Stoneware Mug");

    // Product page
    await page.getByRole("link", { name: "Sahel Salad Bowl" }).click();
    await expect(page).toHaveURL(/\/products\/sahel-salad-bowl$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sahel Salad Bowl");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Kitchen");
    await expect(page.getByTestId("related").getByTestId("product-card")).toHaveCount(4);

    // Add to cart: loading → toast → animated badge, no full reload
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("quantity-value")).toHaveText("2");
    await page.getByTestId("add-to-cart").click();
    const toast = page.getByTestId("toast").filter({ hasText: "Added to cart" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("2 × Sahel Salad Bowl");
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await expect(page.getByTestId("cart-count")).toHaveClass(/animate-badge-bump/);
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true);

    // Add a second product
    await page.goto("/products/basalt-stoneware-mug");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count")).toHaveText("3");

    // Go to the cart via the toast action
    await page
      .getByTestId("toast")
      .filter({ hasText: "Basalt" })
      .getByRole("link", { name: "View cart" })
      .click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId("cart-line")).toHaveCount(2);
    await expect(page.getByTestId("subtotal")).toHaveText("$107.00"); // 2 × 44 + 19
    await expect(page.getByTestId("shipping")).toHaveText("Free");
    await expect(page.getByTestId("checkout")).toBeDisabled();
    await expect(page.getByTestId("checkout")).toHaveText("Checkout coming in Phase 2");

    // Change quantity: subtotal updates instantly
    const mug = page.locator('[data-product="basalt-stoneware-mug"]');
    await mug.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("subtotal")).toHaveText("$126.00");
    await expect(page.getByTestId("cart-count")).toHaveText("4");

    // Reload: the cart persists on the server
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByTestId("cart-line")).toHaveCount(2);
    await expect(mug.getByTestId("quantity-value")).toHaveText("2");
    await expect(page.getByTestId("subtotal")).toHaveText("$126.00");
    await expect(page.getByTestId("cart-count")).toHaveText("4");

    // Remove with undo
    await mug.getByTestId("remove-line").click();
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("subtotal")).toHaveText("$88.00");
    await page
      .getByTestId("toast")
      .filter({ hasText: "Removed from cart" })
      .getByRole("button", { name: "Undo" })
      .click();
    await expect(page.getByTestId("cart-line")).toHaveCount(2);
    await expect(page.getByTestId("subtotal")).toHaveText("$126.00");
    await expect(page.getByTestId("toast").filter({ hasText: "Item restored" })).toBeVisible();

    // Undo persisted on the server too
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByTestId("cart-line")).toHaveCount(2);

    // Remove everything → friendly empty state
    for (let i = 0; i < 2; i++) {
      await page.getByTestId("remove-line").first().click();
    }
    await expect(page.getByTestId("empty-cart")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByTestId("empty-cart")).toBeVisible();
    await page.getByRole("link", { name: "Start shopping" }).click();
    await expect(page).toHaveURL(/\/products$/);
  });
});

test.describe("cart rules", () => {
  test("cart cookie is httpOnly, SameSite=Lax and lasts 30 days", async ({ page, context }) => {
    await page.goto("/products/dune-ceramic-vase");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    const cookie = (await context.cookies()).find((c) => c.name === "ng_cart");
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.value).toMatch(/^[0-9a-f-]{36}$/);
    const days = (cookie!.expires - Date.now() / 1000) / 86400;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  test("adding the same product again increases quantity but never above stock", async ({
    page,
  }) => {
    await page.goto("/products/delta-pour-over-kettle"); // stock 2
    await expect(page.getByTestId("stock-badge")).toHaveText("Only 2 left");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("toast").filter({ hasText: "Only 2 available" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    await page.goto("/cart");
    const line = page.locator('[data-product="delta-pour-over-kettle"]');
    await expect(line.getByTestId("quantity-value")).toHaveText("2");
    await expect(line.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    await line.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(line.getByTestId("quantity-value")).toHaveText("1");
    await expect(line.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });

  test("a new browser context (fresh cookie jar) starts with an empty cart", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/cart");
    await expect(page.getByTestId("empty-cart")).toBeVisible();
    await ctx.close();
  });

  test("the cart survives a browser restart (persistent cookie)", async ({ browser }) => {
    const first = await browser.newContext();
    const page = await first.newPage();
    await page.goto("/products/ember-soy-candle");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    const state = await first.storageState();
    await first.close();

    // A "restarted" browser only keeps persistent (non-session) cookies.
    const persistent = state.cookies.filter((c) => c.expires > 0);
    const second = await browser.newContext({ storageState: { cookies: persistent, origins: [] } });
    const again = await second.newPage();
    await again.goto("/cart");
    await expect(again.getByTestId("cart-line")).toHaveCount(1);
    await expect(again.getByText("Ember Soy Candle")).toBeVisible();
    await second.close();
  });
});

test.describe("edge cases", () => {
  test("responses carry security headers", async ({ page }) => {
    const res = await page.goto("/");
    const h = res!.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("out-of-stock product has a disabled add button", async ({ page }) => {
    await page.goto("/products/lumen-table-lamp");
    await expect(page.getByTestId("stock-badge")).toHaveText("Out of stock");
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();
    await expect(page.getByTestId("add-to-cart")).toHaveText("Out of stock");
  });

  test("unknown product and made-up URLs return a real 404 page", async ({ page }) => {
    const res = await page.goto("/products/this-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "This page wandered off the shelf",
    );
    const res2 = await page.goto("/a/made-up/url");
    expect(res2?.status()).toBe(404);
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("search with no results shows a reset button", async ({ page }) => {
    await page.goto("/products?q=zebra");
    await expect(page.getByTestId("no-results")).toBeVisible();
    await expect(page.getByTestId("result-count")).toContainText("No products found");
    await page.getByRole("link", { name: "Reset filters" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByTestId("product-card")).toHaveCount(12);
  });

  test("garbage query parameters fall back to defaults", async ({ page }) => {
    const res = await page.goto("/products?sort=evil&page=-3&category=%3Cscript%3E");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("result-count")).toHaveText("Showing 1–12 of 24 products");
  });

  test("product pages have Open Graph tags and every page has a title and description", async ({
    page,
  }) => {
    await page.goto("/products/tide-wool-throw");
    await expect(page).toHaveTitle("Tide Wool Throw · Nile Goods");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Tide Wool Throw/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /tide-wool-throw\.svg/,
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /.+/);
    for (const path of ["/", "/products", "/cart", "/info", "/nope"]) {
      await page.goto(path);
      await expect(page).toHaveTitle(/.+/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{20,}/);
    }
  });

  test("skip link is the first tab stop and moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("keyboard only: home → product → add to cart → cart", async ({ page }) => {
    await page.goto("/products/inkwell-ink-bottle");
    // Tab until the add-to-cart button is focused (bounded).
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      if (await page.getByTestId("add-to-cart").evaluate((el) => el === document.activeElement))
        break;
    }
    await expect(page.getByTestId("add-to-cart")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.getByTestId("cart-button").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
  });
});
