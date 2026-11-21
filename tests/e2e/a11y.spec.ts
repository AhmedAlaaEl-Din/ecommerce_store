import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, STAFF_STATE } from "./support/admin";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
    }));
}

const pages = [
  { name: "home", path: "/" },
  { name: "catalog", path: "/products" },
  { name: "catalog filtered + sorted", path: "/products?category=bags&sort=price-desc" },
  { name: "catalog page 2", path: "/products?page=2" },
  { name: "catalog no results", path: "/products?q=zebra" },
  { name: "product (sale)", path: "/products/tide-wool-throw" },
  { name: "product (low stock)", path: "/products/atlas-fountain-pen" },
  { name: "product (out of stock)", path: "/products/courier-leather-crossbody" },
  { name: "cart (empty)", path: "/cart" },
  { name: "help & about", path: "/info" },
  { name: "404", path: "/does-not-exist" },
];

for (const { name, path } of pages) {
  test(`axe: ${name} has no serious or critical violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("axe: cart with items and toast visible", async ({ page }) => {
  await page.goto("/products/sahel-salad-bowl");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("toast")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.goto("/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  expect(await seriousViolations(page)).toEqual([]);
});

test("axe: mobile menu and filter sheet open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByTestId("mobile-menu")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByTestId("open-filters").click();
  await expect(page.getByTestId("filter-sheet")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("axe: checkout (empty form, then with errors), mock pay and order pages", async ({ page }) => {
  await page.goto("/products/grove-olive-wood-board");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.goto("/checkout");
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("checkout-error")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByLabel("Email").fill("mona@example.com");
  await page.getByLabel("Full name").fill("Mona Example");
  await page.getByLabel("Street address").fill("12 Reed Lane");
  await page.getByLabel("Town or city").fill("Delta Town");
  await page.getByLabel("Postal code").fill("DT 1024");
  await page.getByLabel("Country").selectOption("EG");
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/mock-pay\//);
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByTestId("mock-pay").click();
  await expect(page.getByTestId("order-pending")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await expect(page.getByTestId("order-paid")).toBeVisible({ timeout: 15_000 });
  expect(await seriousViolations(page)).toEqual([]);
});

test("axe: checkout on a phone with the summary open, and the cancelled notice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products/bazaar-woven-market-bag");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.goto("/checkout");
  await page.getByTestId("mobile-summary").getByText("Show order summary").click();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByLabel("Email").fill("mona@example.com");
  await page.getByLabel("Full name").fill("Mona Example");
  await page.getByLabel("Street address").fill("12 Reed Lane");
  await page.getByLabel("Town or city").fill("Delta Town");
  await page.getByLabel("Postal code").fill("DT 1024");
  await page.getByLabel("Country").selectOption("EG");
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/mock-pay\//);
  await page.getByTestId("mock-cancel").click();
  await expect(page.getByTestId("checkout-notice")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Phase 3: the admin
// ---------------------------------------------------------------------------
test("axe: admin login page", async ({ page }) => {
  await page.goto("/admin/login");
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByTestId("login-submit").click(); // empty submit shows the error box
  await expect(page.getByTestId("login-error")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test.describe("admin pages (signed in as admin)", () => {
  test.use({ storageState: ADMIN_STATE });

  const adminPages = [
    { name: "dashboard", path: "/admin" },
    { name: "orders list", path: "/admin/orders" },
    { name: "orders filtered (empty)", path: "/admin/orders?q=no-such-order" },
    { name: "products list", path: "/admin/products" },
    { name: "new product form", path: "/admin/products/new" },
    { name: "inventory", path: "/admin/inventory" },
    { name: "categories", path: "/admin/categories" },
    { name: "customers", path: "/admin/customers" },
    { name: "users", path: "/admin/users" },
    { name: "audit log", path: "/admin/audit" },
  ];
  for (const { name, path } of adminPages) {
    test(`axe: admin ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("axe: admin detail pages (order with refund dialog, product edit, stock history, packing slip)", async ({
    page,
  }) => {
    await page.goto("/admin/orders?status=paid");
    await page.getByTestId("order-row").first().getByRole("link").click();
    await expect(page.getByTestId("timeline")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByTestId("refund-order-open").click();
    await expect(page.getByTestId("refund-order")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByTestId("packing-slip").evaluate((a) => a.removeAttribute("target"));
    await page.getByTestId("packing-slip").click();
    await expect(page.getByTestId("packing-slip-page")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto("/admin/products");
    await page.getByTestId("product-row").first().getByRole("link").click();
    await expect(page.getByTestId("product-save")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole("link", { name: "Stock history" }).click();
    await expect(page.getByTestId("adjust-form")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: admin form errors and the mobile drawer", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByTestId("product-save").click();
    await expect(page.getByTestId("form-error")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await page.getByTestId("admin-menu-button").click();
    await expect(page.getByTestId("admin-drawer")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe("admin 403 page (signed in as staff)", () => {
  test.use({ storageState: STAFF_STATE });
  test("axe: admin forbidden page", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByTestId("forbidden")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
