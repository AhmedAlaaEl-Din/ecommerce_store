/**
 * Captures review screenshots of every page at 390x844 and 1440x900 into
 * evidence/phase1/review/. Expects a running server (default
 * http://localhost:3100, e.g. started with `npx tsx scripts/e2e-server.ts`).
 *
 * Run: npm run review:shots
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = join(process.cwd(), "evidence", "phase1", "review");

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

type Shot = {
  name: string;
  path: string;
  prepare?: (page: Page, vp: string) => Promise<void>;
  full?: boolean;
};

const shots: Shot[] = [
  { name: "01-home", path: "/" },
  { name: "02-catalog", path: "/products" },
  { name: "03-catalog-kitchen-price-desc", path: "/products?category=kitchen&sort=price-desc" },
  { name: "04-catalog-no-results", path: "/products?q=zebra" },
  { name: "05-product-sale", path: "/products/tide-wool-throw" },
  { name: "06-product-low-stock", path: "/products/atlas-fountain-pen" },
  { name: "07-product-out-of-stock", path: "/products/courier-leather-crossbody" },
  {
    name: "08-product-added-toast",
    path: "/products/sahel-salad-bowl",
    full: false,
    prepare: async (page) => {
      await page.getByTestId("add-to-cart").click();
      await page.getByTestId("toast").first().waitFor();
      await page.waitForTimeout(400);
    },
  },
  { name: "09-cart-empty", path: "/cart" },
  {
    name: "10-cart-items",
    path: "/cart",
    prepare: async (page) => {
      for (const slug of ["dune-ceramic-vase", "basalt-stoneware-mug", "caravan-canvas-tote"]) {
        await page.goto(`${BASE}/products/${slug}`);
        await page.getByTestId("add-to-cart").click();
        await page.getByTestId("toast").first().waitFor();
      }
      await page.goto(`${BASE}/cart`);
      await page.waitForLoadState("networkidle");
    },
  },
  { name: "11-404", path: "/products/not-a-real-product" },
  { name: "12-info", path: "/info" },
  {
    name: "13-mobile-menu-open",
    path: "/",
    full: false,
    prepare: async (page, vp) => {
      if (vp !== "mobile") throw new Error("skip");
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "14-filter-sheet-open",
    path: "/products",
    full: false,
    prepare: async (page, vp) => {
      if (vp !== "mobile") throw new Error("skip");
      await page.getByTestId("open-filters").click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "15-header-scrolled",
    path: "/products",
    full: false,
    prepare: async (page) => {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(500);
    },
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  for (const vp of viewports) {
    for (const shot of shots) {
      // Fresh context per shot: empty cart, no leftover toasts.
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
        if (shot.prepare) await shot.prepare(page, vp.name);
        if (shot.path === "/cart" && shot.name.includes("items")) await page.waitForTimeout(200);
        await page.screenshot({
          path: join(OUT, `${shot.name}-${vp.name}.png`),
          fullPage: shot.full !== false,
        });
        count++;
      } catch (err) {
        if (!(err instanceof Error && err.message === "skip")) throw err;
      } finally {
        await context.close();
      }
    }
  }
  await browser.close();
  console.log(`Saved ${count} screenshots to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
