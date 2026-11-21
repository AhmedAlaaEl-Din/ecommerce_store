// Dev helper: npx tsx scripts/dev/shot.ts <path> <width> <height> <out.png> [fullPage]
import { chromium } from "@playwright/test";

async function main() {
  const [rawPath = "", w = "1440", h = "900", out = "evidence/dev/shot.png", full = "full"] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  const res = await page.goto(`http://localhost:3000/${rawPath.replace(/^[/]+/, "")}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, fullPage: full === "full" });
  console.log("status", res?.status(), "errors", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
}
main();
