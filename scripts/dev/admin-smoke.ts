/** Dev-only smoke test of the admin login (reads the demo password from var/; never prints it). */
import { chromium } from "@playwright/test";
import { readDemoCredentials } from "../../src/lib/admin/demo-accounts";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3005";

async function main() {
  const creds = readDemoCredentials();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const who = process.env.SMOKE_USER ?? "admin@example.com";
  let res = await page.goto(`${BASE}/admin`);
  console.log("anon /admin ->", page.url(), res?.status());
  await page.getByLabel("Email").fill(who);
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByTestId("login-submit").click();
  await page.getByTestId("login-error").waitFor();
  console.log("bad login error shown");
  await page.getByLabel("Password").fill(creds.get(who)!);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`${BASE}/admin`);
  console.log("logged in ->", await page.locator("h1").first().textContent());
  const paths = (process.env.SMOKE_PATHS ?? "").split(",").filter(Boolean);
  for (const p of paths) {
    res = await page.goto(`${BASE}${p}`);
    console.log(p, "->", res?.status(), (await page.locator("h1").first().textContent())?.trim());
    if (process.env.SMOKE_SHOTS)
      await page.screenshot({
        path: `${process.env.SMOKE_SHOTS}/${p.replace(/\W+/g, "_")}.png`,
        fullPage: true,
      });
  }
  const cookie = (await page.context().cookies()).find((c) => c.name === "ng_admin");
  console.log(
    "cookie path",
    cookie?.path,
    "httpOnly",
    cookie?.httpOnly,
    "sameSite",
    cookie?.sameSite,
  );
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
