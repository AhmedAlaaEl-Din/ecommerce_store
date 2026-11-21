// Dev helper: renders all product SVGs into one PNG so the set can be reviewed at a glance.
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const dir = join(process.cwd(), "public", "products");
  const files = readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
  const cells = files
    .map((f) => `<figure><div>${readFileSync(join(dir, f), "utf8")}</div><figcaption>${f}</figcaption></figure>`)
    .join("");
  const html = `<html><body style="margin:0;font:12px sans-serif;display:grid;grid-template-columns:repeat(6,200px);gap:8px;padding:8px;background:#fff">${cells}<style>figure{margin:0}svg{width:200px;height:200px;display:block}</style></body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1270, height: 900 } });
  await page.setContent(html);
  mkdirSync("evidence/dev", { recursive: true });
  await page.screenshot({ path: "evidence/dev/illustrations.png", fullPage: true });
  await browser.close();
}
main();
