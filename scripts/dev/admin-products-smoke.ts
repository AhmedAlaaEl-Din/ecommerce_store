/** Dev-only: create a product with an image through the admin UI, then check the store and the stored files. */
import { chromium } from "@playwright/test";
import { readdirSync } from "node:fs";
import sharp from "sharp";
import { readDemoCredentials } from "../../src/lib/admin/demo-accounts";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3005";
const SHOTS = process.env.SMOKE_SHOTS;

async function main() {
  const creds = readDemoCredentials();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/admin/login`);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill(creds.get("admin@example.com")!);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`${BASE}/admin`);

  await page.goto(`${BASE}/admin/products`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/products.png`, fullPage: true });
  await page.getByTestId("new-product").click();
  await page.waitForURL(/\/admin\/products\/new$/);
  // Wrong file type first.
  await page.getByLabel("Name", { exact: true }).fill("Smoke Test Carafe");
  await page.getByLabel("Short description").fill("A glass carafe for smoke testing.");
  await page
    .getByLabel("Description", { exact: true })
    .fill("An invented glass carafe used only to test the admin.");
  await page.getByLabel("Price (USD)").fill("31.50");
  await page.getByLabel("Opening stock").fill("7");
  await page.getByTestId("image-input").setInputFiles("tests/fixtures/not-an-image.png");
  await page.getByTestId("product-save").click();
  await page.getByTestId("form-error").waitFor();
  console.log("bad file ->", await page.getByTestId("form-error").textContent());
  console.log("slug kept ->", await page.getByLabel("Slug").inputValue());
  await page.getByTestId("image-input").setInputFiles("tests/fixtures/sample-photo.jpg");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/product-new.png`, fullPage: true });
  await page.getByTestId("product-save").click();
  await page.waitForURL(/\/admin\/products\/[a-z0-9]+\?done=created/);
  console.log("created ->", page.url().replace(BASE, ""));
  const files = readdirSync("public/uploads/products").filter((f) => f.endsWith(".webp"));
  for (const f of files.slice(-2)) {
    const m = await sharp(`public/uploads/products/${f}`).metadata();
    console.log(f, m.format, `${m.width}x${m.height}`, "exif:", !!m.exif, "icc:", !!m.icc);
  }
  const res = await page.goto(`${BASE}/products/smoke-test-carafe`);
  console.log("store page ->", res?.status(), await page.locator("h1").first().textContent());
  const img = await page.locator("main img").first().getAttribute("src");
  const imgRes = await page.request.get(`${BASE}${img}`);
  console.log("image ->", img, imgRes.status(), imgRes.headers()["content-type"]);
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
