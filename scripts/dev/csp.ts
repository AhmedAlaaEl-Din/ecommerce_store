import { chromium, devices } from "@playwright/test";
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["Moto G4"] });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) =>
      console.log("CSPV", e.violatedDirective, e.blockedURI, e.sourceFile, e.lineNumber, e.sample),
    );
  });
  p.on("console", (m) => console.log(m.type(), m.text().slice(0, 300)));
  for (const path of ["/", "/products", "/products/tide-wool-throw"]) {
    console.log("==", path);
    await p.goto("http://localhost:3100" + path, { waitUntil: "networkidle" });
    await p.mouse.wheel(0, 3000);
    await p.waitForTimeout(1500);
  }
  await b.close();
}
main();
