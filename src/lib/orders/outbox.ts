/**
 * Order confirmation "emails" are written as HTML files to var/outbox/
 * (git-ignored). Nothing is ever sent. /dev/outbox lists them in development.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Db } from "../db";
import { formatMoney } from "../money";
import { countryName } from "./checkout-schema";

export function outboxDir(): string {
  return resolve(process.cwd(), process.env.OUTBOX_DIR ?? join("var", "outbox"));
}

/** Only names we generate are ever read back (no path traversal). */
export const OUTBOX_FILE_RE = /^NG-\d{4}-\d{6,}-\d{13}\.html$/;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailOrder = {
  orderNumber: string;
  publicToken: string;
  email: string;
  customerName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  country: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  items: Array<{
    productNameSnapshot: string;
    quantity: number;
    unitPriceCentsSnapshot: number;
    lineTotalCents: number;
  }>;
};

export function renderConfirmationEmail(order: EmailOrder, siteUrl: string): string {
  const e = escapeHtml;
  const money = (c: number) => e(formatMoney(c, order.currency));
  const firstName = order.customerName.split(" ")[0] ?? order.customerName;
  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e7dfd3">${e(i.productNameSnapshot)} <span style="color:#6b6257">× ${i.quantity}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #e7dfd3;text-align:right">${money(i.lineTotalCents)}</td>
      </tr>`,
    )
    .join("");
  const address = [
    order.customerName,
    order.addressLine1,
    order.addressLine2,
    `${order.postalCode} ${order.city}`,
    countryName(order.country),
  ]
    .filter(Boolean)
    .map((l) => e(String(l)))
    .join("<br>");
  const orderUrl = `${siteUrl.replace(/\/$/, "")}/order/${order.publicToken}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your Nile Goods order ${e(order.orderNumber)}</title>
</head>
<body style="margin:0;background:#f6f1ea;font-family:Arial,Helvetica,sans-serif;color:#1f2a24">
<p style="margin:0;padding:8px 16px;background:#1f2a24;color:#fff;font-size:12px">Demo email written to a local file. Nothing was sent. To: ${e(order.email)}</p>
<div style="max-width:560px;margin:24px auto;background:#fffdf9;border:1px solid #e7dfd3;border-radius:12px;padding:32px">
  <p style="margin:0 0 4px;font-size:22px;font-weight:bold;font-family:Georgia,serif">Nile <span style="color:#a4522f;font-style:italic">Goods</span></p>
  <h1 style="font-family:Georgia,serif;font-size:26px;margin:24px 0 8px">Thank you, ${e(firstName)}.</h1>
  <p style="margin:0 0 24px;color:#4b443c">We have your order <strong>${e(order.orderNumber)}</strong> and the payment went through (demo, mock or test mode).</p>
  <table style="width:100%;border-collapse:collapse;font-size:15px">${rows}
    <tr><td style="padding:8px 0;color:#6b6257">Subtotal</td><td style="padding:8px 0;text-align:right">${money(order.subtotalCents)}</td></tr>
    <tr><td style="padding:4px 0;color:#6b6257">Shipping</td><td style="padding:4px 0;text-align:right">${order.shippingCents === 0 ? "Free" : money(order.shippingCents)}</td></tr>
    <tr><td style="padding:12px 0;font-weight:bold;font-size:17px">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold;font-size:17px">${money(order.totalCents)}</td></tr>
  </table>
  <h2 style="font-size:15px;margin:24px 0 8px">Shipping to</h2>
  <p style="margin:0;color:#4b443c;line-height:1.5">${address}</p>
  <p style="margin:32px 0 0"><a href="${e(orderUrl)}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">View your order</a></p>
</div>
</body>
</html>
`;
}

/** Writes the confirmation for a paid order. Returns the file name. */
export async function writeConfirmationEmail(db: Db, orderId: string): Promise<string> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const dir = outboxDir();
  await mkdir(dir, { recursive: true });
  const name = `${order.orderNumber}-${Date.now()}.html`;
  await writeFile(join(dir, name), renderConfirmationEmail(order, siteUrl), "utf8");
  return name;
}

export type OutboxEntry = { name: string; orderNumber: string; size: number; modified: Date };

export async function listOutbox(): Promise<OutboxEntry[]> {
  const dir = outboxDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    names
      .filter((n) => OUTBOX_FILE_RE.test(n))
      .map(async (name) => {
        const s = await stat(join(dir, name));
        return {
          name,
          orderNumber: name.replace(/-\d{13}\.html$/, ""),
          size: s.size,
          modified: s.mtime,
        };
      }),
  );
  return entries.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

export async function readOutboxFile(name: string): Promise<string | null> {
  if (!OUTBOX_FILE_RE.test(name)) return null;
  try {
    return await readFile(join(outboxDir(), name), "utf8");
  } catch {
    return null;
  }
}
