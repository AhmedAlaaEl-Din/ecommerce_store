import { chromium } from "@playwright/test";
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:3000/products/dune-ceramic-vase");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByTestId("add-to-cart").click();
  await page.getByTestId("toast").first().waitFor();
  console.log("toast:", await page.getByTestId("toast").first().innerText());
  console.log("badge:", await page.getByTestId("cart-count").innerText());
  await page.screenshot({ path: "evidence/dev/added.png" });
  await page.goto("http://localhost:3000/products/delta-pour-over-kettle");
  await page.getByTestId("add-to-cart").click();
  await page.waitForTimeout(800);
  await page.goto("http://localhost:3000/cart");
  console.log("subtotal:", await page.getByTestId("subtotal").innerText());
  await page.getByRole("button", { name: "Increase quantity" }).first().click();
  await page.waitForTimeout(800);
  console.log("subtotal after +:", await page.getByTestId("subtotal").innerText());
  await page.reload();
  console.log("subtotal after reload:", await page.getByTestId("subtotal").innerText());
  await page.screenshot({ path: "evidence/dev/cart-d.png", fullPage: true });
  await page.getByTestId("remove-line").first().click();
  await page.getByRole("button", { name: "Undo" }).waitFor();
  console.log("lines after remove:", await page.getByTestId("cart-line").count());
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(800);
  console.log("lines after undo:", await page.getByTestId("cart-line").count());
  const cookies = await ctx.cookies();
  console.log(
    JSON.stringify(
      cookies.map((c) => ({
        n: c.name,
        http: c.httpOnly,
        ss: c.sameSite,
        exp: Math.round((c.expires - Date.now() / 1000) / 86400),
      })),
    ),
  );
  console.log("errors", errors);
  await b.close();
}
main();
