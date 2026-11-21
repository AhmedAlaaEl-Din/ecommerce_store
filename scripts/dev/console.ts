import { chromium } from "@playwright/test";
async function main() {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 300)));
  p.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 300)));
  await p.goto("http://localhost:3100/products?q=zebra", { waitUntil: "networkidle" });
  console.log("no-results visible:", await p.getByTestId("no-results").isVisible());
  await b.close();
}
main();
