import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, type Page } from "@playwright/test";

/** Saved sessions written by admin.setup.ts (git-ignored). */
export const AUTH_DIR = join(process.cwd(), "playwright", ".auth");
export const ADMIN_STATE = join(AUTH_DIR, "admin.json");
export const STAFF_STATE = join(AUTH_DIR, "staff.json");

export const ADMIN_EMAIL = "admin@example.com";
export const STAFF_EMAIL = "staff@example.com";

/**
 * The demo passwords live only in var/demo-credentials.txt (git-ignored, written
 * by the seed). They are typed into password fields and never logged.
 */
export function demoPassword(email: string): string {
  const text = readFileSync(join(process.cwd(), "var", "demo-credentials.txt"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const [e, p] = line.trim().split(/\s+/);
    if (e === email && p) return p;
  }
  throw new Error(`No demo password for ${email} in var/demo-credentials.txt`);
}

export async function login(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(demoPassword(email));
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
}

function e2eDb() {
  return new DatabaseSync(join(process.cwd(), "prisma", "e2e.db"), { readOnly: true });
}

/** Read-only lookups in the e2e database (Playwright can't load the Prisma client). */
export function orderTokenById(id: string): string {
  const db = e2eDb();
  try {
    const row = db.prepare('SELECT publicToken FROM "Order" WHERE id = ?').get(id) as
      { publicToken: string } | undefined;
    if (!row) throw new Error(`No order ${id}`);
    return row.publicToken;
  } finally {
    db.close();
  }
}

export function sessionCount(): number {
  const db = e2eDb();
  try {
    return Number((db.prepare("SELECT COUNT(*) AS n FROM AdminSession").get() as { n: number }).n);
  } finally {
    db.close();
  }
}
