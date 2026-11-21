/**
 * Review screenshots of every admin page (and the Phase 3 storefront changes)
 * at 1440x900 and 390x844 into evidence/phase3/review/.
 *
 * Starts its own production server on a fresh seed + demo history with the
 * mock provider (scripts/e2e-server.ts on port 3300). Signs in with the demo
 * accounts from var/demo-credentials.txt: the password is only ever typed into
 * a password field (dots), never printed or shown. Page-only screenshots.
 *
 * Run: npm run review:shots:phase3   (requires `npm run build` first)
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.REVIEW_PORT ?? "3300";
const BASE = `http://localhost:${PORT}`;
const ROOT = process.cwd();
const OUT = join(ROOT, "evidence", "phase3", "review");

const viewports = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
] as const;
type Vp = (typeof viewports)[number];

function password(email: string): string {
  const text = readFileSync(join(ROOT, "var", "demo-credentials.txt"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const [e, p] = line.trim().split(/\s+/);
    if (e === email && p) return p;
  }
  throw new Error(`No demo password for ${email}`);
}

async function waitForServer(url: string, timeoutMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
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
    env: {
      ...process.env,
      E2E_PORT: PORT,
      OUTBOX_DIR: "var/outbox-review",
      UPLOADS_DIR: "var/uploads-review",
    },
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

async function context(browser: Browser, vp: Vp) {
  return browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    reducedMotion: "reduce",
  });
}

async function shot(page: Page, vp: Vp, name: string, full = true) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `${name}-${vp.name}.png`), fullPage: full });
  // Flag horizontal page overflow (a table or grid pushing the page wider than the screen).
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  const flag = width > vp.width ? `   <-- OVERFLOW: page is ${width}px wide` : "";
  console.log(`  ${name}-${vp.name}.png${flag}`);
}

async function signIn(page: Page, email: string) {
  await page.goto(`${BASE}/admin/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password(email));
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`${BASE}/admin`);
}

async function openOrder(page: Page, query: string) {
  await page.goto(`${BASE}/admin/orders?${query}`);
  await page.getByTestId("order-row").first().getByRole("link").click();
  await page.waitForURL(/\/admin\/orders\/[a-z0-9]+$/);
  return page.url();
}

async function adminTour(browser: Browser, vp: Vp) {
  const ctx = await context(browser, vp);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/login`);
  await shot(page, vp, "01-login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByTestId("login-submit").click();
  await page.getByTestId("login-error").waitFor();
  await shot(page, vp, "02-login-error");

  await signIn(page, "admin@example.com");
  await shot(page, vp, "03-dashboard");
  if (vp.isMobile) {
    await page.getByTestId("admin-menu-button").click();
    await page.getByTestId("admin-drawer").waitFor();
    await shot(page, vp, "04-drawer", false);
    await page.keyboard.press("Escape");
  }
  await page.goto(`${BASE}/admin/orders`);
  await shot(page, vp, "05-orders");
  await page.goto(`${BASE}/admin/orders?status=paid&fulfilment=packed`);
  await shot(page, vp, "06-orders-filtered");
  await page.goto(`${BASE}/admin/orders?q=no-such-order`);
  await shot(page, vp, "07-orders-empty");

  const url = await openOrder(page, "status=paid&fulfilment=packed");
  await shot(page, vp, "08-order-packed");
  await page.getByTestId("mark-shipped").click(); // native "required" shows, nothing is sent
  await page.goto(url);
  await page.getByTestId("refund-order-open").click();
  await page.getByTestId("refund-order").waitFor();
  await shot(page, vp, "09-refund-dialog", false);
  await page.keyboard.press("Escape");
  await page.goto(`${url}/packing-slip`);
  await shot(page, vp, "10-packing-slip");

  await page.goto(`${BASE}/admin/products`);
  await shot(page, vp, "12-products");
  await page.goto(`${BASE}/admin/products?state=archived`);
  await shot(page, vp, "13-products-empty");
  await page.goto(`${BASE}/admin/products/new`);
  await shot(page, vp, "14-product-new");
  await page.getByTestId("product-save").click();
  await page.getByTestId("form-error").waitFor();
  await shot(page, vp, "15-product-new-errors");
  await page.goto(`${BASE}/admin/products`);
  await page.getByTestId("product-row").first().getByRole("link").click();
  await page.getByTestId("product-save").waitFor();
  await shot(page, vp, "16-product-edit");
  await page.getByTestId("archive-open").click();
  await page.getByTestId("archive").waitFor();
  await shot(page, vp, "17-archive-dialog", false);
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/admin/inventory`);
  await shot(page, vp, "18-inventory");
  await page.getByRole("link", { name: "History & adjust" }).first().click();
  await page.getByTestId("adjust-form").waitFor();
  await shot(page, vp, "19-stock-history");

  await page.goto(`${BASE}/admin/categories`);
  await shot(page, vp, "20-categories");
  await page.getByTestId("category-row").first().getByRole("link", { name: "Edit" }).click();
  await shot(page, vp, "21-category-edit");
  await page.goto(`${BASE}/admin/customers`);
  await shot(page, vp, "22-customers");
  await page.goto(`${BASE}/admin/users`);
  await shot(page, vp, "23-users");
  await page.goto(`${BASE}/admin/audit`);
  await shot(page, vp, "24-audit");
  await ctx.close();
}

async function staffTour(browser: Browser, vp: Vp) {
  const ctx = await context(browser, vp);
  const page = await ctx.newPage();
  await signIn(page, "staff@example.com");
  await shot(page, vp, "25-staff-dashboard");
  await page.goto(`${BASE}/admin/users`);
  await shot(page, vp, "26-staff-forbidden");
  await page.goto(`${BASE}/admin/products`);
  await page.getByTestId("product-row").first().getByRole("link").click();
  await shot(page, vp, "27-staff-product");
  await ctx.close();
}

async function storefront(browser: Browser, vp: Vp) {
  const ctx = await context(browser, vp);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/products/sahel-salad-bowl`);
  await page.getByTestId("add-to-cart").click();
  await page.getByTestId("toast").first().waitFor();
  await page.goto(`${BASE}/checkout`);
  await shot(page, vp, "28-checkout-focused", false);
  await ctx.close();
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const server = startServer();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    for (const vp of viewports) {
      console.log(vp.name);
      await adminTour(browser, vp);
      await staffTour(browser, vp);
      await storefront(browser, vp);
    }
    await browser.close();
  } finally {
    stopServer(server);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
