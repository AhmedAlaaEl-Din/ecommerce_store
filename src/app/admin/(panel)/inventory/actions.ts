"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { setLowStockThreshold } from "@/lib/admin/inventory";
import { adjustStock, bulkSetStock } from "@/lib/admin/products";
import { db } from "@/lib/db";
import { MANUAL_REASONS, reasonAllowsDelta, type ManualReason } from "@/lib/inventory/stock";

export type AdjustState = { error?: string; ok?: string };

/** Staff and admins: one stock adjustment with a reason (and optional note). */
export async function adjustStockAction(_prev: AdjustState, fd: FormData): Promise<AdjustState> {
  const { user } = await requireAdmin();
  const productId = String(fd.get("productId") ?? "");
  const reason = String(fd.get("reason") ?? "") as ManualReason;
  const qty = Number.parseInt(String(fd.get("quantity") ?? ""), 10);
  const direction = fd.get("direction") === "remove" ? -1 : 1;
  if (!(MANUAL_REASONS as readonly string[]).includes(reason)) return { error: "Choose a reason." };
  if (!Number.isInteger(qty) || qty < 1 || qty > 100_000) {
    return { error: "Enter a quantity from 1 to 100,000." };
  }
  const delta = reason === "damaged" ? -qty : reason === "correction" ? direction * qty : qty;
  if (!reasonAllowsDelta(reason, delta))
    return { error: "That reason can’t move stock in that direction." };
  const note = String(fd.get("note") ?? "")
    .trim()
    .slice(0, 200);
  const res = await adjustStock(db, user, { productId, delta, reason, note: note || undefined });
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { ok: `Saved. Stock is now ${res.value}.` };
}

/** Staff and admins: the bulk table posts stock_<id> and expected_<id> pairs. */
export async function bulkStockAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const rows: Array<{ productId: string; stock: number; expected: number }> = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("stock_") || typeof value !== "string" || value.trim() === "") continue;
    const productId = key.slice("stock_".length);
    const stock = Number(value);
    const expected = Number(fd.get(`expected_${productId}`));
    if (!/^\d{1,6}$/.test(value.trim()) || !Number.isInteger(expected)) continue;
    if (stock !== expected) rows.push({ productId, stock, expected });
    if (rows.length > 200) break;
  }
  const res = await bulkSetStock(db, user, rows);
  revalidatePath("/", "layout");
  const back = String(fd.get("back") ?? "");
  const qs = new URLSearchParams(back.startsWith("?") ? back.slice(1) : "");
  qs.set("done", res.value.conflicts.length ? "bulk_conflicts" : "bulk_saved");
  qs.set("changed", String(res.value.changed));
  redirect(`/admin/inventory?${qs.toString()}`);
}

/** Admins only: the low-stock threshold (default 3). */
export async function thresholdAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const value = Number.parseInt(String(fd.get("threshold") ?? ""), 10);
  const res = await setLowStockThreshold(db, user, value);
  revalidatePath("/admin", "layout");
  redirect(`/admin/inventory?done=${res.ok ? "threshold_saved" : "threshold_invalid"}`);
}
