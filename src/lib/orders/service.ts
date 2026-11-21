/**
 * Orders: stock reservation, payment state transitions and expiry.
 *
 * Stock model: `Product.stock` is the AVAILABLE quantity. Starting checkout
 * reserves stock by decrementing it with a conditional update
 * (`stock >= qty`), so two shoppers can never both take the last unit. A failed,
 * cancelled or expired order puts the stock back exactly once (the status change
 * from `pending_payment` is itself conditional). A paid order keeps it.
 *
 * Every function takes a Prisma client so it can run against the test database.
 */
import { randomBytes } from "node:crypto";
import type { Db } from "../db";
import { cartTotals, lineTotalCents } from "../cart/math";
import type { ProviderName } from "../payments/config";
import { applyStockChange, recordMovement } from "../inventory/stock";
import type { CheckoutCustomer } from "./checkout-schema";

export const RESERVATION_MINUTES = 30;

export type OrderStatus =
  "pending_payment" | "paid" | "payment_failed" | "cancelled" | "expired" | "refunded";
export type ReleaseStatus = Exclude<OrderStatus, "pending_payment" | "paid" | "refunded">;

/** Phase 3: timeline entry for an order (shown in the admin). */
export async function addOrderEvent(
  tx: Pick<Tx, "orderEvent">,
  e: { orderId: string; type: string; message: string; actorId?: string | null; now?: Date },
) {
  await tx.orderEvent.create({
    data: {
      orderId: e.orderId,
      type: e.type,
      message: e.message,
      actorId: e.actorId ?? null,
      ...(e.now ? { createdAt: e.now } : {}),
    },
  });
}

const RELEASE_MESSAGES: Record<ReleaseStatus, string> = {
  payment_failed: "Payment declined; reserved stock released",
  cancelled: "Order cancelled; reserved stock released",
  expired: "Reservation expired; stock released",
};

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

/** NG-2026-000123: prefix, year, zero-padded sequence (grows past 6 digits if needed). */
export function formatOrderNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invalid order number parts");
  }
  return `NG-${year}-${String(sequence).padStart(6, "0")}`;
}

export const ORDER_NUMBER_RE = /^NG-\d{4}-\d{6,}$/;

/** Unguessable token for order URLs: 192 bits, URL-safe. */
export function newPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

export const PUBLIC_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

async function nextOrderNumber(tx: Tx, now: Date): Promise<string> {
  const year = now.getUTCFullYear();
  const counter = await tx.orderCounter.upsert({
    where: { year },
    create: { year, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatOrderNumber(year, counter.value);
}

/** SQLite reports lock contention as SQLITE_BUSY; retry the whole transaction a few times. */
async function withBusyRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const busy = /SQLITE_BUSY|database is locked|SocketTimeout|Transaction already closed/i.test(
        msg,
      );
      if (!busy || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 25 * i + Math.floor(Math.random() * 25)));
    }
  }
}

// ---------------------------------------------------------------------------
// Creating an order (reservation)
// ---------------------------------------------------------------------------

export type StockChange = { productId: string; name: string; requested: number; available: number };

export type CreateOrderResult =
  | {
      ok: true;
      order: {
        id: string;
        publicToken: string;
        orderNumber: string;
        email: string;
        currency: string;
        shippingCents: number;
        reservedUntil: Date;
        lines: Array<{ name: string; unitAmountCents: number; quantity: number }>;
      };
      /** Provider sessions of earlier pending orders from this cart, now cancelled. */
      supersededSessionIds: string[];
    }
  | { ok: false; code: "EMPTY_CART" }
  | { ok: false; code: "MIXED_CURRENCY" }
  | { ok: false; code: "STOCK_CHANGED"; changes: StockChange[] };

/**
 * Re-reads prices and stock, reserves stock and creates a `pending_payment`
 * order in ONE transaction. If anything is short, nothing is written and the
 * cart quantities are adjusted to what is available.
 */
export async function createPendingOrder(
  db: Db,
  input: { cartId: string | null; customer: CheckoutCustomer; provider: ProviderName; now?: Date },
): Promise<CreateOrderResult> {
  const now = input.now ?? new Date();
  if (!input.cartId) return { ok: false, code: "EMPTY_CART" };
  const cartId = input.cartId;

  // Free stock held by abandoned checkouts first (same logic as `npm run orders:expire`).
  await expireStaleOrders(db, now);

  const cartItems = await db.cartItem.findMany({
    where: { cartId, product: { isActive: true } },
    orderBy: { id: "asc" },
    select: { productId: true, quantity: true },
  });
  if (cartItems.length === 0) return { ok: false, code: "EMPTY_CART" };

  const superseded: string[] = [];
  const order = await withBusyRetry(() =>
    db.$transaction(async (tx) => {
      // 0. One pending order per cart: a resubmit (e.g. Back from the payment
      //    page) cancels the earlier one and returns its stock first, so a cart
      //    never holds stock twice and never has two payable sessions.
      superseded.length = 0;
      // First statement is a write (touching the cart), so this transaction takes
      // SQLite's write lock immediately; reads that follow cannot be invalidated
      // by another writer (avoids lock-upgrade failures across processes).
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: now } });
      const previous = await tx.order.findMany({
        where: { cartId, status: "pending_payment" },
        select: { id: true, providerSessionId: true },
      });
      for (const p of previous) {
        if ((await releaseOrderInTx(tx, p.id, "cancelled")) && p.providerSessionId) {
          superseded.push(p.providerSessionId);
        }
      }

      // 1. Reserve: conditional decrements (`stock >= qty`).
      const reserved: Array<{ productId: string; quantity: number }> = [];
      let short = false;
      for (const item of cartItems) {
        const res = await tx.product.updateMany({
          where: { id: item.productId, isActive: true, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (res.count === 1) reserved.push(item);
        else short = true;
      }
      if (short) {
        // Put back what this attempt took and COMMIT (no rollback): with the
        // single-connection SQLite driver a rollback could also undo unrelated
        // writes interleaved on the same connection.
        for (const r of reserved) {
          await tx.product.update({
            where: { id: r.productId },
            data: { stock: { increment: r.quantity } },
          });
        }
        return null;
      }

      // 2. Prices come from the database, inside the same transaction.
      const products = await tx.product.findMany({
        where: { id: { in: cartItems.map((i) => i.productId) } },
        select: { id: true, name: true, priceCents: true, currency: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const lines = cartItems.map((i) => {
        const p = byId.get(i.productId)!;
        return {
          productId: p.id,
          name: p.name,
          priceCents: p.priceCents,
          quantity: i.quantity,
          currency: p.currency,
        };
      });
      const currencies = new Set(lines.map((l) => l.currency));
      if (currencies.size !== 1) {
        // Never charge a mixed cart in one currency: put the stock back and stop.
        for (const l of lines) {
          await tx.product.update({
            where: { id: l.productId },
            data: { stock: { increment: l.quantity } },
          });
        }
        return "MIXED_CURRENCY" as const;
      }
      const totals = cartTotals(lines);
      const currency = lines[0]!.currency;
      const reservedUntil = new Date(now.getTime() + RESERVATION_MINUTES * 60_000);

      const created = await tx.order.create({
        data: {
          publicToken: newPublicToken(),
          orderNumber: await nextOrderNumber(tx, now),
          status: "pending_payment",
          email: input.customer.email,
          customerName: input.customer.name,
          addressLine1: input.customer.addressLine1,
          addressLine2: input.customer.addressLine2 || null,
          city: input.customer.city,
          postalCode: input.customer.postalCode,
          country: input.customer.country,
          subtotalCents: totals.subtotalCents,
          shippingCents: totals.shippingCents,
          discountCents: 0,
          totalCents: totals.totalCents,
          currency,
          provider: input.provider,
          cartId,
          reservedUntil,
          createdAt: now,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              productNameSnapshot: l.name,
              unitPriceCentsSnapshot: l.priceCents,
              quantity: l.quantity,
              lineTotalCents: lineTotalCents(l),
            })),
          },
        },
        include: { items: true },
      });
      // Phase 3: stock history and timeline. The decrements above already ran in
      // this transaction, so the current stock is the "after" value.
      for (const item of created.items) {
        const p = await tx.product.findUniqueOrThrow({
          where: { id: item.productId },
          select: { stock: true },
        });
        await recordMovement(tx, {
          productId: item.productId,
          delta: -item.quantity,
          reason: "reservation",
          stockAfter: p.stock,
          orderId: created.id,
          now,
        });
      }
      await addOrderEvent(tx, {
        orderId: created.id,
        type: "created",
        message: `Order placed; stock reserved for ${RESERVATION_MINUTES} minutes`,
        now,
      });
      return created;
    }),
  );

  if (order === "MIXED_CURRENCY") return { ok: false, code: "MIXED_CURRENCY" };
  if (!order) {
    return { ok: false, code: "STOCK_CHANGED", changes: await adjustCartToStock(db, cartId) };
  }
  return {
    ok: true,
    order: {
      id: order.id,
      publicToken: order.publicToken,
      orderNumber: order.orderNumber,
      email: order.email,
      currency: order.currency,
      shippingCents: order.shippingCents,
      reservedUntil: order.reservedUntil,
      lines: order.items.map((i) => ({
        name: i.productNameSnapshot,
        unitAmountCents: i.unitPriceCentsSnapshot,
        quantity: i.quantity,
      })),
    },
    supersededSessionIds: [...superseded],
  };
}

/** Clamps cart quantities to current stock (removing sold-out lines) and reports what changed. */
async function adjustCartToStock(db: Db, cartId: string): Promise<StockChange[]> {
  const items = await db.cartItem.findMany({
    where: { cartId },
    select: {
      id: true,
      quantity: true,
      productId: true,
      product: { select: { name: true, stock: true, isActive: true } },
    },
  });
  const changes: StockChange[] = [];
  for (const item of items) {
    const available = item.product.isActive ? Math.max(item.product.stock, 0) : 0;
    if (item.quantity <= available) continue;
    changes.push({
      productId: item.productId,
      name: item.product.name,
      requested: item.quantity,
      available,
    });
  }
  if (changes.length > 0) {
    // Writes go through a transaction (see the note on the SQLite adapter in the report).
    await db.$transaction(async (tx) => {
      for (const c of changes) {
        if (c.available === 0) {
          await tx.cartItem.deleteMany({ where: { cartId, productId: c.productId } });
        } else {
          await tx.cartItem.updateMany({
            where: { cartId, productId: c.productId },
            data: { quantity: c.available },
          });
        }
      }
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
    });
  }
  return changes;
}

/** Stores the provider's session id once the session exists. */
export async function attachProviderSession(db: Db, orderId: string, sessionId: string) {
  await db.$transaction((tx) =>
    tx.order.update({ where: { id: orderId }, data: { providerSessionId: sessionId } }),
  );
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/**
 * Moves a pending order to a released status and returns its stock, exactly
 * once. Returns false if the order was not pending (already paid/released).
 */
export async function releaseOrderInTx(
  tx: Tx,
  orderId: string,
  to: ReleaseStatus,
): Promise<boolean> {
  const res = await tx.order.updateMany({
    where: { id: orderId, status: "pending_payment" },
    data: { status: to },
  });
  if (res.count !== 1) return false;
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true },
  });
  for (const item of items) {
    await applyStockChange(tx, {
      productId: item.productId,
      delta: item.quantity,
      reason: "release",
      orderId,
    });
  }
  await addOrderEvent(tx, { orderId, type: to, message: RELEASE_MESSAGES[to] });
  return true;
}

export async function releaseOrder(db: Db, orderId: string, to: ReleaseStatus): Promise<boolean> {
  return withBusyRetry(() => db.$transaction((tx) => releaseOrderInTx(tx, orderId, to)));
}

export type PaidResult = "paid" | "already_paid" | "paid_after_release" | "paid_oversold";

/**
 * Marks an order paid and clears its cart. If the order had already been
 * released (a late payment after expiry), the stock is taken again if it is
 * still there; otherwise the order is flagged as oversold for manual follow-up.
 */
export async function markOrderPaidInTx(tx: Tx, orderId: string, now: Date): Promise<PaidResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true, cartId: true, items: { select: { productId: true, quantity: true } } },
  });
  if (!order) throw new Error("Order not found");
  if (order.status === "paid") return "already_paid";

  let result: PaidResult = "paid";
  if (order.status !== "pending_payment") {
    result = "paid_after_release";
    for (const item of order.items) {
      const after = await applyStockChange(tx, {
        productId: item.productId,
        delta: -item.quantity,
        reason: "sale",
        orderId,
        note: "Payment arrived after the reservation was released",
      });
      if (after === null) result = "paid_oversold";
    }
  }
  await tx.order.update({
    where: { id: orderId },
    data: {
      status: "paid",
      paidAt: now,
      // Flag late/oversold payments for manual follow-up.
      fulfilmentNote: result === "paid" ? null : result,
    },
  });
  await addOrderEvent(tx, {
    orderId,
    type: "paid",
    message:
      result === "paid"
        ? "Payment received"
        : result === "paid_after_release"
          ? "Payment received after the reservation expired; stock taken again"
          : "Payment received after the reservation expired; stock was short (needs follow-up)",
    now,
  });
  if (order.cartId) {
    // Remove only what was bought: items added to the cart after checkout stay.
    for (const item of order.items) {
      await tx.cartItem.updateMany({
        where: { cartId: order.cartId, productId: item.productId },
        data: { quantity: { decrement: item.quantity } },
      });
    }
    await tx.cartItem.deleteMany({ where: { cartId: order.cartId, quantity: { lte: 0 } } });
  }
  return result;
}

/**
 * Releases stock for pending orders whose reservation has passed. Used by
 * `npm run orders:expire` and before every checkout attempt.
 */
export async function expireStaleOrders(db: Db, now = new Date()): Promise<number> {
  const stale = await db.order.findMany({
    where: { status: "pending_payment", reservedUntil: { lt: now } },
    select: { id: true },
    take: 500,
  });
  let released = 0;
  for (const o of stale) {
    if (await releaseOrder(db, o.id, "expired")) released++;
  }
  return released;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function getOrderByToken(db: Db, publicToken: string) {
  if (!PUBLIC_TOKEN_RE.test(publicToken)) return null;
  return db.order.findUnique({
    where: { publicToken },
    include: { items: { orderBy: { id: "asc" } } },
  });
}

export type OrderView = NonNullable<Awaited<ReturnType<typeof getOrderByToken>>>;
