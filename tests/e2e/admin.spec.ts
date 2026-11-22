import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_STATE,
  demoPassword,
  login,
  orderTokenById,
  STAFF_EMAIL,
  STAFF_STATE,
} from "./support/admin";

/** Every admin page, with who may see it. ":id" pages use a made-up id (404 for allowed roles). */
const ADMIN_PAGES: Array<{ path: string; adminOnly: boolean }> = [
  { path: "/admin", adminOnly: false },
  { path: "/admin/orders", adminOnly: false },
  { path: "/admin/orders/does-not-exist", adminOnly: false },
  { path: "/admin/orders/does-not-exist/packing-slip", adminOnly: false },
  { path: "/admin/products", adminOnly: false },
  { path: "/admin/products/does-not-exist", adminOnly: false },
  { path: "/admin/products/new", adminOnly: true },
  { path: "/admin/inventory", adminOnly: false },
  { path: "/admin/inventory/does-not-exist", adminOnly: false },
  { path: "/admin/categories", adminOnly: true },
  { path: "/admin/categories/does-not-exist", adminOnly: true },
  { path: "/admin/customers", adminOnly: true },
  { path: "/admin/users", adminOnly: true },
  { path: "/admin/audit", adminOnly: true },
  { path: "/admin/orders/export", adminOnly: true },
];

async function openFirstOrder(page: Page, query: string) {
  await page.goto(`/admin/orders?${query}`);
  const row = page.getByTestId("order-row").first();
  await expect(row).toBeVisible();
  await row.getByRole("link").click();
  await expect(page).toHaveURL(/\/admin\/orders\/[a-z0-9]+$/);
  return page.url().split("/").pop()!;
}

test.describe("admin: signing in", () => {
  test("anonymous visitors go to the login page; a bad login shows one generic message", async ({
    page,
  }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to the admin" })).toBeVisible();
    // Not linked from the storefront, and never indexed.
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");

    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText(
      "That email and password don't match an active account. After 5 failed tries an account is locked for 15 minutes.",
    );
    await expect(page.getByLabel("Email")).toHaveValue("nobody@example.com");
    await expect(page.getByLabel("Password")).toHaveValue("");

    const home = await page.request.get("/");
    expect(await home.text()).not.toContain("/admin");
  });

  test("admin journey: login → dashboard → create a product with an image → it is in the store", async ({
    page,
    context,
  }) => {
    await login(page, ADMIN_EMAIL);
    const cookie = (await context.cookies()).find((c) => c.name === "ng_admin");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/admin" });
    await expect(page.getByTestId("admin-role")).toHaveText("Admin");
    await expect(page.getByTestId("kpis")).toBeVisible();
    await expect(page.getByTestId("revenue-chart-scroll")).toBeVisible();
    await expect(page.getByTestId("kpi-30d")).not.toContainText("$0.00"); // demo history

    await page.getByRole("link", { name: "Products", exact: true }).first().click();
    await page.getByTestId("new-product").click();
    await page.getByLabel("Name", { exact: true }).fill("Lotus Serving Tray");
    await expect(page.getByLabel("Slug")).toHaveValue("lotus-serving-tray");
    await page.getByLabel("Short description").fill("A shallow tray for tea and dates.");
    await page
      .getByLabel("Description", { exact: true })
      .fill("A shallow serving tray in pale olive wood, finished with food-safe oil.");
    await page.getByLabel("Price (USD)").fill("38.00");
    await page.getByLabel("Opening stock").fill("5");
    await page.getByLabel("Category").selectOption({ label: "Kitchen" });
    await expect(page.getByTestId("product-preview")).toContainText("Lotus Serving Tray");
    await expect(page.getByTestId("product-preview")).toContainText("$38.00");

    // A file that only pretends to be an image is refused; typed values stay.
    await page.getByTestId("image-input").setInputFiles("tests/fixtures/not-an-image.png");
    await page.getByTestId("product-save").click();
    await expect(page.getByTestId("form-error")).toContainText("Only JPEG, PNG or WebP");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Lotus Serving Tray");

    await page.getByTestId("image-input").setInputFiles("tests/fixtures/sample-photo.jpg");
    await page.getByTestId("product-save").click();
    await expect(page).toHaveURL(/\/admin\/products\/[a-z0-9]+\?done=created$/);
    await expect(page.getByTestId("notice")).toHaveText("Product created.");

    await page.goto("/products/lotus-serving-tray");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lotus Serving Tray");
    const src = await page.locator("main img").first().getAttribute("src");
    expect(src).toMatch(/^\/media\/products\/p-[a-f0-9]{24}-1200\.webp$/);
    const img = await page.request.get(src!);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/webp");
    // Re-encoded: no EXIF block ("Exif\0\0") from the original photo survives.
    expect((await img.body()).includes(Buffer.from("Exif\0\0"))).toBe(false);
    await page.goto("/products?q=lotus");
    await expect(page.getByTestId("product-card")).toHaveCount(1);
  });
});

test.describe("admin: daily work", () => {
  test.use({ storageState: ADMIN_STATE });

  test("adjust stock with a reason; the history explains the number", async ({ page }) => {
    await page.goto("/admin/inventory?q=meridian");
    await page.getByRole("link", { name: "History & adjust" }).click();
    const before = Number(await page.getByTestId("current-stock").textContent());
    await page.getByLabel("Reason").selectOption("received");
    await page.getByLabel("Quantity").fill("4");
    await page.getByLabel("Note (optional)").fill("Delivery DEMO-77");
    await page.getByTestId("adjust-save").click();
    await expect(page.getByTestId("adjust-ok")).toHaveText(`Saved. Stock is now ${before + 4}.`);
    await page.reload();
    await expect(page.getByTestId("current-stock")).toHaveText(String(before + 4));
    const first = page.getByTestId("movement-row").first();
    await expect(first).toContainText("Received");
    await expect(first).toContainText("+4");
    await expect(first).toContainText("Delivery DEMO-77");
    await expect(page.getByTestId("balance-check")).toContainText("✓");

    // Damaged can't take more than there is.
    await page.getByLabel("Reason").selectOption("damaged");
    await page.getByLabel("Quantity").fill("9999");
    await page.getByTestId("adjust-save").click();
    await expect(page.getByTestId("adjust-error")).toContainText("can't go below zero");
  });

  test("bulk stock edit saves counted numbers as corrections", async ({ page }) => {
    await page.goto("/admin/inventory?q=inkwell");
    await page.getByTestId("bulk-inkwell-ink-bottle").fill("13");
    await page.getByTestId("bulk-save").click();
    await expect(page.getByTestId("notice")).toContainText("1 product updated");
    await expect(page.getByTestId("inventory-row").first()).toContainText("13");
  });

  test("fulfil an order to shipped with tracking; the customer's order page shows it", async ({
    page,
  }) => {
    const id = await openFirstOrder(page, "status=paid&fulfilment=unfulfilled");
    await page.getByTestId("mark-packed").click();
    await expect(page.getByTestId("notice")).toHaveText("Marked as packed.");
    await page.getByLabel("Carrier").fill("Nile Post (demo)");
    await page.getByLabel("Tracking number").fill("NP-DEMO-4471");
    await page.getByTestId("mark-shipped").click();
    await expect(page.getByTestId("notice")).toContainText("Marked as shipped.");
    await expect(page.getByTestId("tracking")).toContainText("NP-DEMO-4471");
    await expect(page.getByTestId("timeline")).toContainText(
      "Marked as shipped with Nile Post (demo) (NP-DEMO-4471)",
    );

    await page.goto(`/order/${orderTokenById(id)}`);
    await expect(page.getByTestId("fulfilment-status")).toHaveText("Shipped");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    await expect(page.getByTestId("tracking-info")).toContainText("Nile Post (demo)");
    await expect(page.getByTestId("tracking-info")).toContainText("NP-DEMO-4471");
  });

  test("refund an order after confirming; the timeline and customer page show it", async ({
    page,
  }) => {
    const id = await openFirstOrder(page, "status=paid&fulfilment=delivered");
    await page.getByTestId("refund-order-open").click();
    const dialog = page.getByTestId("refund-order");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("This can’t be undone");
    // Cancel first: nothing happens.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await page.getByTestId("refund-order-open").click();
    await page.getByTestId("refund-order-confirm").click();
    await expect(page.getByTestId("notice")).toContainText("Refund issued.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Refunded");
    await expect(page.getByTestId("timeline")).toContainText("Full refund issued (mock)");
    await expect(page.getByTestId("refund-order-open")).toHaveCount(0);

    await page.goto(`/order/${orderTokenById(id)}`);
    await expect(page.getByTestId("order-refunded")).toContainText("refunded in full");
  });

  test("orders filter, notes stay text, CSV export is safe", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.getByTestId("filter-status").selectOption("cancelled");
    await page.getByTestId("filter-apply").click();
    await expect(page).toHaveURL(/status=cancelled/);
    const rows = page.getByTestId("order-row");
    await expect(rows.first()).toContainText("Cancelled");

    await openFirstOrder(page, "status=paid");
    await page
      .getByLabel("Add an internal note")
      .fill("<img src=x onerror=alert(1)> leave at door");
    await page.getByTestId("note-save").click();
    await expect(page.getByTestId("notes")).toContainText(
      "<img src=x onerror=alert(1)> leave at door",
    );
    await expect(page.locator('[data-testid="notes"] img')).toHaveCount(0);

    const csv = await page.request.get("/admin/orders/export?status=paid");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-disposition"]).toMatch(
      /attachment; filename="nile-goods-orders-/,
    );
    const text = await csv.text();
    expect(text.split("\r\n")[0]).toContain("Order number,Created (UTC),Payment");
    expect(text).not.toMatch(/(^|,)[=+@]/m);
  });

  test("admin pages are not cached, not indexed and send no referrer", async ({ page }) => {
    const res = await page.goto("/admin/orders");
    const h = res!.headers();
    expect(h["cache-control"]).toContain("no-store");
    expect(h["x-robots-tag"]).toContain("noindex");
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  });
});

test.describe("admin: authorization over HTTP", () => {
  test("anonymous requests to every admin page are sent to login", async ({ request }) => {
    for (const { path } of ADMIN_PAGES) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers()["location"], path).toMatch(/\/admin\/login$/);
    }
  });

  test.describe("as staff", () => {
    test.use({ storageState: STAFF_STATE });

    test("admin-only pages answer 403; the rest work", async ({ page }) => {
      for (const { path, adminOnly } of ADMIN_PAGES) {
        const res = await page.request.get(path, { maxRedirects: 0 });
        if (adminOnly) expect(res.status(), path).toBe(403);
        else expect([200, 404], path).toContain(res.status());
      }
    });

    test("forbidden pages show the 403 page and hidden controls are absent", async ({ page }) => {
      const res = await page.goto("/admin/users");
      expect(res!.status()).toBe(403);
      await expect(page.getByTestId("forbidden")).toContainText(
        "You don’t have access to this page",
      );
      await expect(page.getByTestId("admin-role")).toHaveText("Staff");

      // The sidebar only lists what staff can use.
      const nav = page.getByRole("navigation", { name: "Admin", exact: true });
      for (const hidden of ["Users", "Audit log", "Categories", "Customers"]) {
        await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
      }
      await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();

      await page.goto("/admin/products");
      await expect(page.getByTestId("new-product")).toHaveCount(0);
      await page.getByTestId("product-row").first().getByRole("link").click();
      await expect(page.getByTestId("product-save")).toHaveCount(0);
      await expect(page.getByTestId("archive-open")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Adjust stock" })).toBeVisible();

      await page.goto("/admin/orders");
      await expect(page.getByTestId("export-csv")).toHaveCount(0);
      await openFirstOrder(page, "status=paid&fulfilment=delivered");
      await expect(page.getByTestId("refund-order-open")).toHaveCount(0);
      await expect(page.getByTestId("note-form")).toBeVisible();

      await page.goto("/admin/inventory");
      await expect(page.getByTestId("threshold-form")).toHaveCount(0);
      await expect(page.getByTestId("bulk-form")).toBeVisible();
    });
  });
});

test("logout deletes the session; the old cookie no longer works", async ({ page, context }) => {
  await login(page, ADMIN_EMAIL);
  const before = (await context.cookies()).find((c) => c.name === "ng_admin")!;
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await context.cookies()).find((c) => c.name === "ng_admin")).toBeUndefined();
  // Replaying the old cookie is useless: the session row is gone.
  await context.addCookies([before]);
  const res = await page.request.get("/admin", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/\/admin\/login$/);
});

test("the staff demo account can sign in with its own password", async ({ page }) => {
  expect(demoPassword(STAFF_EMAIL)).toMatch(/^[A-Za-z0-9_-]{24}$/);
  await login(page, STAFF_EMAIL);
  await expect(page.getByTestId("admin-role")).toHaveText("Staff");
});

test.describe("dashboard revenue chart fits its card", () => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`at ${size.width}x${size.height} every bar is inside the card and nothing scrolls`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: ADMIN_STATE, viewport: size });
      const page = await context.newPage();
      await page.goto("/admin");
      const svg = page.locator('svg[data-testid^="revenue-chart-"]:visible');
      await expect(svg).toHaveCount(1);
      await expect(svg).toBeVisible();
      const card = page.locator("#revenue");
      const cardBox = (await card.boundingBox())!;
      const svgBox = (await svg.boundingBox())!;
      expect(svgBox.width).toBeLessThanOrEqual(cardBox.width);
      expect(svgBox.x + svgBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
      // The last bar (today) must be fully inside the card, and all 30 bars exist.
      const bars = svg.locator("rect");
      expect(await bars.count()).toBe(30);
      const last = (await bars.last().boundingBox())!;
      expect(last.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(last.x + last.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
      // No sideways scrolling inside the chart, none on the page.
      const scrolls = await page
        .getByTestId("revenue-chart-scroll")
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(scrolls).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        size.width,
      );
      await context.close();
    });
  }
});

test.describe("dashboard KPI values are never clipped", () => {
  const widths = [1024, 1280, 1366, 1440, 1600, 1920, 390];
  for (const deviceScaleFactor of [1, 1.25]) {
    for (const width of widths) {
      test(`$99,999.99 fits its card at ${width}px, scale ${deviceScaleFactor}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          storageState: ADMIN_STATE,
          viewport: { width, height: 900 },
          deviceScaleFactor,
        });
        const page = await context.newPage();
        await page.goto("/admin");
        await expect(page.getByTestId("kpis")).toBeVisible();
        // Worst case money in every money card (the value is the second <p>).
        await page.evaluate(() => {
          for (const id of ["kpi-today", "kpi-7d", "kpi-30d", "kpi-aov"]) {
            const v = document.querySelector(`[data-testid="${id}"] p:nth-of-type(2)`)!;
            v.textContent = "$99,999.99";
          }
        });
        const result = await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="kpis"] > div')].map((card) => {
            const value = card.querySelector("p:nth-of-type(2)") as HTMLElement;
            const range = document.createRange();
            range.selectNodeContents(value);
            const text = range.getBoundingClientRect();
            const c = card.getBoundingClientRect();
            return {
              id: card.getAttribute("data-testid"),
              clipped: value.scrollWidth > value.clientWidth,
              textInside: text.left >= c.left - 0.5 && text.right <= c.right + 0.5,
            };
          }),
        );
        expect(result).toHaveLength(6);
        for (const r of result) {
          expect(r.clipped, `${r.id} scrollWidth`).toBe(false);
          expect(r.textInside, `${r.id} inside card`).toBe(true);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await context.close();
      });
    }
  }
});

test.describe("big numbers on other admin pages never overflow", () => {
  for (const width of [390, 1024, 1440]) {
    test(`orders, order detail, products and stock history at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: ADMIN_STATE,
        viewport: { width, height: 900 },
        deviceScaleFactor: 1.25,
      });
      const page = await context.newPage();
      const stress = async () => {
        await page.evaluate(() => {
          for (const el of document.querySelectorAll("main .tabular-nums")) {
            if (el.children.length === 0 && /[$\d]/.test(el.textContent ?? ""))
              el.textContent = "$99,999,999.99";
          }
        });
        const bad = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of document.querySelectorAll("main .tabular-nums")) {
            const h = el as HTMLElement;
            if (h.scrollWidth > h.clientWidth) out.push(`clipped: ${h.className}`);
            // Anything outside the viewport must sit inside a scroll container.
            const r = h.getBoundingClientRect();
            if (r.right > window.innerWidth + 0.5) {
              let p: HTMLElement | null = h.parentElement;
              let scrolls = false;
              while (p && p !== document.body) {
                if (getComputedStyle(p).overflowX === "auto") scrolls = true;
                p = p.parentElement;
              }
              if (!scrolls) out.push(`outside viewport: ${h.className}`);
            }
          }
          if (document.documentElement.scrollWidth > window.innerWidth) out.push("page scrolls sideways");
          return out;
        });
        expect(bad).toEqual([]);
      };
      await page.goto("/admin/orders");
      await stress();
      await page.locator('a[href^="/admin/orders/"]:not([href$="export"])').first().click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await stress();
      await page.goto("/admin/products");
      await stress();
      await page.goto("/admin/inventory");
      await page.locator('a[href^="/admin/inventory/"]').first().click();
      await expect(page.getByTestId("current-stock")).toBeVisible();
      await stress();
      await context.close();
    });
  }
});
