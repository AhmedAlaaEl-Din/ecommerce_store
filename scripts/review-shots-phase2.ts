/**
 * Review screenshots of every Phase 2 page/state at 390x844 and 1440x900 into
 * evidence/phase2/review/. Expects the mock-payment production server on :3100
 * (`npx tsx scripts/e2e-server.ts`). Demo data only.
 *
 * Run: npm run review:shots:phase2
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = join(process.cwd(), "evidence", "phase2", "review");

const viewports = [
  { name: "mobile", width: 390, height: 844, isMobile: true },
  { name: "desktop", width: 1440, height: 900, isMobile: false },
] as const;

type Vp = (typeof viewports)[number];

const MONA = {
  email: "mona@example.com",
  name: "Mona Example",
  addressLine1: "12 Reed Lane",
  addressLine2: "Studio 4",
  city: "Delta Town",
  postalCode: "DT 1024",
  country: "nilera",
};

async function newPage(browser: Browser, vp: Vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    reducedMotion: "reduce",
  });
  return ctx.newPage();
}

async function shot(page: Page, vp: Vp, name: string, full = true) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, `${name}-${vp.name}.png`), fullPage: full });
  console.log(`  ${name}-${vp.name}.png`);
}

async function add(page: Page, slug: string) {
  await page.goto(`${BASE}/products/${slug}`);
  await page.getByTestId("add-to-cart").click();
  await page.getByTestId("toast").first().waitFor();
}

async function fill(page: Page) {
  await page.getByLabel("Email").fill(MONA.email);
  await page.getByLabel("Full name").fill(MONA.name);
  await page.getByLabel("Street address").fill(MONA.addressLine1);
  await page.getByLabel("Apartment, suite, etc. (optional)").fill(MONA.addressLine2);
  await page.getByLabel("Town or city").fill(MONA.city);
  await page.getByLabel("Postal code").fill(MONA.postalCode);
  await page.getByLabel("Country").selectOption(MONA.country);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of viewports) {
    console.log(vp.name);
    const page = await newPage(browser, vp);
    await add(page, "sahel-salad-bowl");
    await add(page, "basalt-stoneware-mug");

    await page.goto(`${BASE}/cart`);
    await shot(page, vp, "01-cart-checkout-enabled");
    await page.goto(`${BASE}/checkout`);
    await shot(page, vp, "02-checkout");
    if (vp.isMobile) {
      await page.getByTestId("mobile-summary").getByText("Show order summary").click();
      await shot(page, vp, "03-checkout-summary-open", false);
      await page.getByTestId("mobile-summary").getByText("Hide order summary").click();
    }
    await page.getByTestId("place-order").click();
    await page.getByTestId("checkout-error").waitFor();
    await shot(page, vp, "04-checkout-errors");
    await fill(page);
    await shot(page, vp, "05-checkout-filled");

    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/mock-pay\//);
    await shot(page, vp, "06-mock-pay");
    await page.getByTestId("mock-decline").click();
    await page.waitForURL(/status=failed/);
    const failedToken = new URL(page.url()).searchParams.get("order");
    await shot(page, vp, "07-checkout-declined");
    await page.goto(`${BASE}/order/${failedToken}`);
    await shot(page, vp, "08-order-not-completed");

    await page.goto(`${BASE}/checkout?order=${failedToken}&status=payment_failed`);
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/mock-pay\//);
    await page.getByTestId("mock-cancel").click();
    await page.waitForURL(/status=cancelled/);
    await shot(page, vp, "09-checkout-cancelled");

    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/mock-pay\//);
    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/order\//);
    await page.getByTestId("order-pending").waitFor();
    await page.screenshot({ path: join(OUT, `10-order-confirming-${vp.name}.png`), fullPage: true });
    console.log(`  10-order-confirming-${vp.name}.png`);
    await page.getByTestId("order-paid").waitFor({ timeout: 15_000 });
    await shot(page, vp, "11-order-paid");
    await page.context().close();

    // Sold out between cart and checkout (two shoppers, last unit).
    const a = await newPage(browser, vp);
    const b = await newPage(browser, vp);
    await add(a, "ibis-enamel-teapot");
    await add(b, "ibis-enamel-teapot");
    await b.goto(`${BASE}/checkout`);
    await fill(b);
    await a.goto(`${BASE}/checkout`);
    await fill(a);
    await a.getByTestId("place-order").click();
    await a.waitForURL(/\/mock-pay\//);
    await b.getByTestId("place-order").click();
    await b.waitForURL(/\/cart\?adjusted=/);
    await shot(b, vp, "12-cart-stock-adjusted");
    await a.getByTestId("mock-cancel").click(); // put the teapot back
    await a.waitForURL(/status=cancelled/);
    await a.context().close();
    await b.context().close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
