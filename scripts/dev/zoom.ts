import { chromium } from "@playwright/test";
async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto("http://localhost:3100/products/sahel-salad-bowl", { waitUntil: "networkidle" });
  const price = p.getByTestId("price").first();
  await price.scrollIntoViewIfNeeded();
  await price.screenshot({ path: "evidence/dev/zoom-price.png" });
  await p.getByTestId("add-to-cart").click();
  await p.getByTestId("toast").first().waitFor();
  await p.waitForTimeout(500);
  await price.screenshot({ path: "evidence/dev/zoom-price-after.png" });
  await b.close();
}
main();
