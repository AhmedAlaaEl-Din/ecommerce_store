/**
 * Stock changes and their history. Every change to Product.stock goes through
 * applyStockChange(), which writes a StockMovement in the same transaction, so
 * the sum of a product's movements always equals its stock.
 */
import type { Db } from "../db";
import type { Tx } from "../admin/audit";

export type StockReason =
  | "initial"
  | "received"
  | "damaged"
  | "correction"
  | "return"
  | "reservation"
  | "release"
  | "sale"
  | "refund_restock";

/** Reasons an admin or staff member can pick for a manual adjustment. */
export const MANUAL_REASONS = ["received", "damaged", "correction", "return"] as const;
export type ManualReason = (typeof MANUAL_REASONS)[number];

export const REASON_LABELS: Record<StockReason, string> = {
  initial: "Opening stock",
  received: "Received",
  damaged: "Damaged",
  correction: "Correction",
  return: "Customer return",
  reservation: "Reserved by order",
  release: "Released by order",
  sale: "Late payment",
  refund_restock: "Restocked after refund",
};

/** Which way a manual reason may move stock. Corrections go either way. */
export function reasonAllowsDelta(reason: ManualReason, delta: number): boolean {
  if (!Number.isInteger(delta) || delta === 0) return false;
  if (reason === "received" || reason === "return") return delta > 0;
  if (reason === "damaged") return delta < 0;
  return true;
}

export type StockChange = {
  productId: string;
  delta: number;
  reason: StockReason;
  orderId?: string | null;
  actorId?: string | null;
  note?: string | null;
  now?: Date;
};

/**
 * Applies a stock change inside a transaction. Decrements are conditional
 * (`stock >= -delta`) so stock never goes below zero. Returns the new stock, or
 * null if the decrement was refused.
 */
export async function applyStockChange(tx: Tx, c: StockChange): Promise<number | null> {
  if (!Number.isInteger(c.delta) || c.delta === 0) throw new Error("Invalid stock delta");
  const res = await tx.product.updateMany({
    where: { id: c.productId, ...(c.delta < 0 ? { stock: { gte: -c.delta } } : {}) },
    data: { stock: { increment: c.delta } },
  });
  if (res.count !== 1) return null;
  const p = await tx.product.findUniqueOrThrow({
    where: { id: c.productId },
    select: { stock: true },
  });
  await recordMovement(tx, { ...c, stockAfter: p.stock });
  return p.stock;
}

/** Writes a movement for a change that was already applied (stockAfter known). */
export async function recordMovement(tx: Tx, c: StockChange & { stockAfter: number }) {
  await tx.stockMovement.create({
    data: {
      productId: c.productId,
      delta: c.delta,
      reason: c.reason,
      stockAfter: c.stockAfter,
      orderId: c.orderId ?? null,
      actorId: c.actorId ?? null,
      note: c.note ? c.note.slice(0, 200) : null,
      ...(c.now ? { createdAt: c.now } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Low-stock threshold (a setting, default 3)
// ---------------------------------------------------------------------------

export const LOW_STOCK_KEY = "lowStockThreshold";
export const DEFAULT_LOW_STOCK = 3;

export async function getLowStockThreshold(db: Pick<Db, "setting">): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: LOW_STOCK_KEY } });
  const n = row ? Number.parseInt(row.value, 10) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_LOW_STOCK;
}
