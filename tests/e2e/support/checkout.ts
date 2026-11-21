import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";

/** Demo shopper: invented person and address. */
export const MONA = {
  email: "mona@example.com",
  name: "Mona Example",
  addressLine1: "12 Reed Lane",
  addressLine2: "Studio 4",
  city: "Delta Town",
  postalCode: "DT 1024",
  country: "nilera",
};

export type Shopper = typeof MONA;

export async function addToCart(page: Page, slug: string, quantity = 1) {
  await page.goto(`/products/${slug}`);
  for (let i = 1; i < quantity; i++) {
    await page.getByRole("button", { name: "Increase quantity" }).click();
  }
  const badge = page.getByTestId("cart-count");
  const before = (await badge.count()) > 0 ? Number(await badge.textContent()) : 0;
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText(String(before + quantity));
}

export async function fillCheckout(page: Page, s: Partial<Shopper> = {}) {
  const v = { ...MONA, ...s };
  await page.getByLabel("Email").fill(v.email);
  await page.getByLabel("Full name").fill(v.name);
  await page.getByLabel("Street address").fill(v.addressLine1);
  await page.getByLabel("Apartment, suite, etc. (optional)").fill(v.addressLine2);
  await page.getByLabel("Town or city").fill(v.city);
  await page.getByLabel("Postal code").fill(v.postalCode);
  await page.getByLabel("Country").selectOption(v.country);
}

/** Cart → checkout → fill → mock pay page. */
export async function goToMockPay(page: Page, s: Partial<Shopper> = {}) {
  await page.goto("/checkout");
  await fillCheckout(page, s);
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/mock-pay\/mock_cs_/);
  await expect(page.getByTestId("mock-banner")).toHaveText(
    "Mock payment page. No real payment provider is used.",
  );
}

/** Reads a product's available stock straight from the e2e database (read-only). */
export async function stockOf(slug: string): Promise<number> {
  const db = new DatabaseSync(join(process.cwd(), "prisma", "e2e.db"), { readOnly: true });
  try {
    const row = db.prepare("SELECT stock FROM Product WHERE slug = ?").get(slug) as
      { stock: number } | undefined;
    if (!row) throw new Error(`No product ${slug}`);
    return Number(row.stock);
  } finally {
    db.close();
  }
}

export function outboxFiles(orderNumber: string): string[] {
  const dir = join(process.cwd(), "var", "outbox-e2e");
  try {
    return readdirSync(dir).filter((f) => f.startsWith(`${orderNumber}-`));
  } catch {
    return [];
  }
}
