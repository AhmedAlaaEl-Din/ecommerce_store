/** Dev-only: fulfil and refund an order through the admin UI; check CSV, packing slip, users, audit. */
import { chromium } from "@playwright/test";
import { readDemoCredentials } from "../../src/lib/admin/demo-accounts";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3005";
const SHOTS = process.env.SMOKE_SHOTS;

async function main() {
  const creds = readDemoCredentials();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`${BASE}/admin/login`);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill(creds.get("admin@example.com")!);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`${BASE}/admin`);

  await page.goto(`${BASE}/admin/orders?status=paid&fulfilment=unfulfilled`);
  console.log("filtered ->", await page.getByTestId("result-count").textContent());
  await page.getByTestId("order-row").first().getByRole("link").click();
  await page.waitForURL(/\/admin\/orders\/[a-z0-9]+$/);
  const orderUrl = page.url();
  const number = (await page.locator("h1").textContent())?.slice(0, 14);
  console.log("order", number);
  await page.getByTestId("mark-packed").click();
  await page.waitForURL(/done=packed/);
  await page.getByTestId("mark-shipped").click();
  await page.getByTestId("fulfilment-error").waitFor().catch(() => undefined);
  console.log("ship without tracking ->", await page.getByTestId("fulfilment-error").textContent().catch(() => "no error shown (native required?)"));
  await page.getByLabel("Carrier").fill("Nile Post (demo)");
  await page.getByLabel("Tracking number").fill("DEMO-123456");
  await page.getByTestId("mark-shipped").click();
  await page.waitForURL(/done=shipped/);
  console.log("tracking ->", (await page.getByTestId("tracking").textContent())?.replace(/\s+/g, " "));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-detail.png`, fullPage: true });
  await page.getByTestId("note-form").getByLabel("Add an internal note").fill("<b>Fragile</b> — wrap twice");
  await page.getByTestId("note-save").click();
  await page.waitForURL(/done=note/);
  console.log("note rendered as text ->", await page.getByTestId("notes").locator("p").first().textContent());

  await page.getByTestId("refund-order-open").click();
  await page.getByTestId("refund-restock").check();
  await page.getByTestId("refund-order-confirm").click();
  await page.waitForURL(/done=refunded/);
  console.log("after refund ->", (await page.locator("h1").textContent())?.replace(/\s+/g, " "));
  console.log("timeline ->", (await page.getByTestId("timeline").textContent())?.slice(0, 400));

  const slip = await page.request.get(`${orderUrl}/packing-slip`);
  console.log("packing slip ->", slip.status());
  const csv = await page.request.get(`${BASE}/admin/orders/export?status=paid`);
  const body = await csv.text();
  console.log("csv ->", csv.status(), csv.headers()["content-type"], csv.headers()["content-disposition"], "rows:", csv.headers()["x-row-count"]);
  console.log(body.split("\r\n").slice(0, 2).join("\n"));
  for (const p of ["/admin/customers", "/admin/users", "/admin/audit", "/admin/categories"]) {
    const r = await page.goto(`${BASE}${p}`);
    console.log(p, r?.status());
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${p.replace(/\W+/g, "_")}.png`, fullPage: false });
  }
  const res = await page.goto(`${BASE}/admin/orders`);
  console.log("headers", res?.headers()["cache-control"], "|", res?.headers()["x-robots-tag"], "|", res?.headers()["referrer-policy"]);
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
