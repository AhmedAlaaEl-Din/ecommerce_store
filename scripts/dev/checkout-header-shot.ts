/** Dev-only: screenshots of the focused checkout header (desktop + phone) and an order page. */
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3005";
const OUT = process.env.SMOKE_SHOTS ?? ".";

async function main() {
  const browser = await chromium.launch();
  for (const [name, viewport] of [["desktop", { width: 1280, height: 800 }], ["phone", { width: 390, height: 844 }]] as const) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${BASE}/products/sahel-salad-bowl`);
    await page.getByTestId("add-to-cart").click();
    await page.getByTestId("toast").first().waitFor();
    await page.goto(`${BASE}/checkout`);
    await page.screenshot({ path: `${OUT}/checkout-${name}.png` });
    await page.close();
  }
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
