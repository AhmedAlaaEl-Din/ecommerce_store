// Dev helper: walks the mock checkout once against the server on :3100 and saves screenshots.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const OUT = "evidence/dev/checkout";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 300)));
  page.on("console", (m) => m.type() === "error" && console.log("console", m.text().slice(0, 300)));
  await page.goto(`${BASE}/products/sahel-salad-bowl`);
  await page.getByTestId("add-to-cart").click();
  await page.getByTestId("cart-count").filter({ hasText: "1" }).waitFor();
  await page.goto(`${BASE}/cart`);
  await page.getByTestId("checkout").click();
  await page.waitForURL(/\/checkout$/);
  await page.screenshot({ path: `${OUT}/1-checkout.png`, fullPage: true });
  await page.getByTestId("place-order").click();
  await page.getByTestId("checkout-error").waitFor();
  await page.screenshot({ path: `${OUT}/2-errors.png`, fullPage: true });
  await page.getByLabel("Email").fill("mona@example.com");
  await page.getByLabel("Full name").fill("Mona Example");
  await page.getByLabel("Street address").fill("12 Reed Lane");
  await page.getByLabel("Town or city").fill("Delta Town");
  await page.getByLabel("Postal code").fill("DT 1024");
  await page.getByLabel("Country").selectOption("nilera");
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/mock-pay\//);
  await page.screenshot({ path: `${OUT}/3-mock-pay.png`, fullPage: true });
  await page.getByTestId("mock-pay").click();
  await page.waitForURL(/\/order\//);
  await page.screenshot({ path: `${OUT}/4-confirming.png`, fullPage: true });
  await page.getByTestId("order-paid").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/5-paid.png`, fullPage: true });
  console.log("cart badge:", await page.getByTestId("cart-count").count());
  await b.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
