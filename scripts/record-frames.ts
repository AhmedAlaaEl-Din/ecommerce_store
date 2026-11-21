/**
 * Records demo frames for the Phase 1 video.
 *
 * - Starts its own production server on a freshly reseeded database
 *   (scripts/e2e-server.ts -> prisma/e2e.db), so every run starts from the
 *   same state with an empty cart.
 * - Captures page-only screenshots (no browser chrome) for two sets:
 *   desktop 1280x720 and mobile 390x844, as zero-padded PNGs in
 *   evidence/phase1/desktop/ and evidence/phase1/mobile/.
 * - Writes evidence/phase1/storyboard.json (file, step, caption, duration).
 *
 * Run: npm run frames   (requires `npm run build` first)
 */
import { chromium, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.FRAMES_PORT ?? "3200";
const BASE = `http://localhost:${PORT}`;
const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "phase1");

type Frame = { file: string; set: string; step: string; caption: string; duration: number };
const storyboard: Frame[] = [];

class Recorder {
  private n = 0;
  constructor(
    private page: Page,
    private set: "desktop" | "mobile",
  ) {
    rmSync(join(OUT, set), { recursive: true, force: true });
    mkdirSync(join(OUT, set), { recursive: true });
  }

  /** One still frame. */
  async snap(step: string, caption: string, duration = 1.2) {
    this.n++;
    const name = `${String(this.n).padStart(4, "0")}.png`;
    await this.page.screenshot({ path: join(OUT, this.set, name), animations: "allow" });
    storyboard.push({ file: `${this.set}/${name}`, set: this.set, step, caption, duration });
  }

  /** Several frames ~60 ms apart, to capture an animation. */
  async burst(step: string, caption: string, count = 5, gapMs = 60) {
    for (let i = 0; i < count; i++) {
      await this.snap(step, caption, 0.08);
      await this.page.waitForTimeout(gapMs);
    }
  }

  /** Smooth scroll in a few steps, one frame per step. */
  async scrollTo(step: string, caption: string, y: number, steps = 4) {
    const start = await this.page.evaluate(() => window.scrollY);
    for (let i = 1; i <= steps; i++) {
      const to = Math.round(start + ((y - start) * i) / steps);
      await this.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), to);
      await this.page.waitForTimeout(120);
      await this.snap(step, caption, i === steps ? 1.2 : 0.25);
    }
  }
}

async function waitForServer(url: string, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not start at ${url}`);
}

function startServer(): ChildProcess {
  return spawn("npx tsx scripts/e2e-server.ts", {
    cwd: ROOT,
    env: { ...process.env, E2E_PORT: PORT },
    stdio: ["ignore", "ignore", "inherit"],
    shell: true,
  });
}

function stopServer(server: ChildProcess) {
  if (process.platform === "win32" && server.pid) {
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

async function story(page: Page, rec: Recorder, mobile: boolean) {
  const settle = () => page.waitForLoadState("networkidle");

  // 1. Home hero
  await page.goto(BASE, { waitUntil: "networkidle" });
  await rec.snap("home", "Nile Goods: a calm, editorial home-goods store (demo).", 2.5);
  if (!mobile) await page.getByRole("link", { name: "Shop the collection" }).hover();
  await page.waitForTimeout(200);
  await rec.snap("home", "One clear primary action.", 1.2);

  // 2. Scroll to featured
  const featuredY = await page
    .getByTestId("featured-row")
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 80);
  await rec.scrollTo("featured", "Featured products, illustrated by hand as SVG.", featuredY);

  // 3. Category
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  if (mobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(300);
    await rec.snap("category", "Accessible mobile menu.", 1.5);
    await page.getByTestId("mobile-menu").getByRole("link", { name: "Kitchen" }).click();
  } else {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Kitchen" })
      .hover();
    await rec.snap("category", "Browse by category.", 1.0);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Kitchen" })
      .click();
  }
  await page.waitForURL(/category=kitchen/);
  await settle();
  await rec.snap("category", "Kitchen: every filter lives in the URL.", 2.0);

  // 4. Search
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const search = page.getByTestId("catalog-search");
  await search.click();
  for (const part of ["l", "li", "lin", "line", "linen"]) {
    await search.fill(part);
    await page.waitForTimeout(80);
    await rec.snap("search", "Search as you type.", 0.2);
  }
  await search.press("Enter");
  await page.waitForURL(/q=linen/);
  await settle();
  await rec.snap("search", "Results for “linen”.", 2.0);

  // 5. Sort
  await page.goto(`${BASE}/products?category=bags`, { waitUntil: "networkidle" });
  await rec.snap("sort", "Bags, newest first.", 1.2);
  if (mobile) {
    await page.getByTestId("open-filters").click();
    await page.waitForTimeout(350);
    await rec.snap("sort", "Filters and sorting in a bottom sheet on mobile.", 1.5);
    await page
      .getByTestId("filter-sheet")
      .getByRole("radio", { name: "Price: low to high" })
      .check();
    await rec.snap("sort", "Sort by price, low to high.", 1.0);
    await page.getByTestId("apply-filters").click();
  } else {
    await page.getByTestId("sort-select").selectOption("price-asc");
  }
  await page.waitForURL(/sort=price-asc/);
  await settle();
  await rec.snap("sort", "Sorted by price, low to high.", 2.0);

  // 6. Product page
  await page.goto(`${BASE}/products/tide-wool-throw`, { waitUntil: "networkidle" });
  await rec.snap("product", "Product page: sale price, stock and benefits.", 2.5);

  // 7. Add to cart (toast + badge animation)
  const add = page.getByTestId("add-to-cart");
  if (mobile) {
    const y = await add.evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 360);
    await rec.scrollTo("product", "Full-width Add to cart on mobile.", y, 3);
  } else {
    await add.hover();
    await page.waitForTimeout(150);
    await rec.snap("product", "Add to cart.", 1.0);
  }
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await rec.snap("add-to-cart", "Choose a quantity.", 1.0);
  await add.click();
  await rec.burst("add-to-cart", "Added to cart: toast and animated badge.", 6, 60);
  await page.getByTestId("toast").first().waitFor();
  await page.waitForTimeout(250);
  await rec.snap("add-to-cart", "Added to cart, with a quick link to the cart.", 2.0);

  // Add one more product so the cart has two lines.
  await page.goto(`${BASE}/products/basalt-stoneware-mug`, { waitUntil: "networkidle" });
  await page.getByTestId("add-to-cart").click();
  await rec.burst("add-to-cart", "The badge bumps on every add.", 5, 60);
  await page.getByTestId("toast").first().waitFor();

  // 8. Cart
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await rec.snap("cart", "The cart lives on the server, keyed by an httpOnly cookie.", 2.5);
  if (mobile) {
    const y = await page
      .getByTestId("order-summary")
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 120);
    await rec.scrollTo("cart", "Order summary with free-shipping progress.", y, 3);
    await rec.scrollTo("cart", "Back to the items.", 0, 2);
  } else {
    await rec.snap("cart", "Order summary stays in view on desktop.", 1.5);
  }

  // 9. Change quantity
  const mug = page.locator('[data-product="basalt-stoneware-mug"]');
  await mug.getByRole("button", { name: "Increase quantity" }).click();
  await rec.burst("change-quantity", "Quantity and totals update instantly.", 4, 60);
  await settle();
  await rec.snap("change-quantity", "Subtotal updated.", 1.5);

  // 10. Reload persists
  await rec.snap("reload", "Now reload the page…", 1.0);
  await page.reload({ waitUntil: "networkidle" });
  await rec.snap("reload", "After a reload, the cart is still there.", 2.0);

  // 11. Remove and undo
  await mug.getByTestId("remove-line").click();
  await rec.burst("remove-undo", "Remove an item…", 4, 60);
  await page.getByTestId("toast").filter({ hasText: "Removed" }).waitFor();
  await rec.snap("remove-undo", "…with an Undo option.", 1.5);
  await page
    .getByTestId("toast")
    .filter({ hasText: "Removed" })
    .getByRole("button", { name: "Undo" })
    .click();
  await page.getByTestId("toast").filter({ hasText: "Item restored" }).waitFor();
  await page.waitForTimeout(200);
  await rec.snap("remove-undo", "Undo puts it back.", 2.0);

  // 12. Empty cart
  await rec.snap("empty-cart", "Remove everything…", 1.0);
  while ((await page.getByTestId("remove-line").count()) > 0) {
    await page.getByTestId("remove-line").first().click();
    await page.waitForTimeout(250);
    await rec.snap("empty-cart", "Removing…", 0.4);
  }
  await page.getByTestId("empty-cart").waitFor();
  await settle();
  await page.waitForTimeout(300);
  await rec.snap("empty-cart", "A friendly empty state.", 2.0);

  // 13. Out-of-stock product
  await page.goto(`${BASE}/products/lumen-table-lamp`, { waitUntil: "networkidle" });
  await rec.snap("out-of-stock", "Out-of-stock products can’t be added.", 2.0);
  const disabled = page.getByTestId("add-to-cart");
  if (mobile) {
    const y = await disabled.evaluate(
      (el) => el.getBoundingClientRect().top + window.scrollY - 360,
    );
    await rec.scrollTo(
      "out-of-stock",
      "The button is disabled, with a pointer to similar pieces.",
      y,
      3,
    );
  } else {
    await disabled.hover();
    await rec.snap(
      "out-of-stock",
      "The button is disabled, with a pointer to similar pieces.",
      1.5,
    );
  }

  // 14. 404
  await page.goto(`${BASE}/products/a-made-up-product`, { waitUntil: "networkidle" });
  await rec.snap("404", "A real 404, in the same style.", 2.5);
  if (!mobile) await page.getByRole("link", { name: "Back to home" }).hover();
  await page.waitForTimeout(200);
  await rec.snap("404", "A clear way back home.", 2.0);
}

async function main() {
  const server = startServer();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    for (const set of ["desktop", "mobile"] as const) {
      const mobile = set === "mobile";
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      const rec = new Recorder(page, set);
      await story(page, rec, mobile);
      await context.close();
    }
    await browser.close();
    writeFileSync(
      join(OUT, "storyboard.json"),
      JSON.stringify(
        {
          title: "Nile Goods: Phase 1 demo",
          note: "Page-only screenshots. Durations are suggestions in seconds.",
          sets: {
            desktop: {
              width: 1280,
              height: 720,
              frames: storyboard.filter((f) => f.set === "desktop").length,
            },
            mobile: {
              width: 390,
              height: 844,
              frames: storyboard.filter((f) => f.set === "mobile").length,
            },
          },
          frames: storyboard,
        },
        null,
        2,
      ) + "\n",
    );
    const d = storyboard.filter((f) => f.set === "desktop").length;
    const m = storyboard.filter((f) => f.set === "mobile").length;
    console.log(`Recorded ${d} desktop and ${m} mobile frames into ${OUT}`);
  } finally {
    stopServer(server);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
