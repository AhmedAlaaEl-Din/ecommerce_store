/**
 * Admin order operations: list/filter, fulfilment, internal notes, cancel and
 * full refunds through the PaymentProvider interface.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "../db";
import { applyStockChange } from "../inventory/stock";
import { logError } from "../log";
import { countryName } from "../orders/checkout-schema";
import { addOrderEvent, releaseOrderInTx } from "../orders/service";
import type { PaymentProvider } from "../payments/types";
import { assertCan, fail, type Actor } from "./actor";
import { writeAudit } from "./audit";
import { toCsv } from "./csv";
import {
  checkFulfilmentTransition,
  checkRefund,
  canCancel,
  FULFILMENT_LABELS,
  PAYMENT_LABELS,
  type FulfilmentStatus,
  type PaymentStatus,
} from "./order-rules";

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export const ORDER_SORTS = ["createdAt", "totalCents", "orderNumber", "customerName"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export type OrderFilters = {
  q?: string;
  status?: PaymentStatus;
  fulfilment?: FulfilmentStatus;
  /** yyyy-mm-dd, inclusive, UTC */
  from?: string;
  to?: string;
  sort?: OrderSort;
  dir?: "asc" | "desc";
  page?: number;
};

export const ORDER_PAGE_SIZE = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function orderWhere(f: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.fulfilment) where.fulfilmentStatus = f.fulfilment;
  const created: Prisma.DateTimeFilter = {};
  if (f.from && DATE_RE.test(f.from)) created.gte = new Date(`${f.from}T00:00:00.000Z`);
  if (f.to && DATE_RE.test(f.to))
    created.lt = new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86_400_000);
  if (created.gte || created.lt) where.createdAt = created;
  const q = f.q?.trim().slice(0, 100);
  if (q) {
    where.OR = [
      { orderNumber: { contains: q.toUpperCase() } },
      { email: { contains: q.toLowerCase() } },
      { customerName: { contains: q } },
    ];
  }
  return where;
}

export async function listOrders(db: Db, f: OrderFilters) {
  const where = orderWhere(f);
  const sort = f.sort ?? "createdAt";
  const dir = f.dir ?? "desc";
  const page = Math.max(1, f.page ?? 1);
  const [total, rows] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: [{ [sort]: dir }, { id: "asc" }],
      skip: (page - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        customerName: true,
        email: true,
        status: true,
        fulfilmentStatus: true,
        totalCents: true,
        currency: true,
        _count: { select: { items: true } },
      },
    }),
  ]);
  return { total, rows, page, pageCount: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)) };
}

export async function getOrderDetail(db: Db, id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: { product: { select: { slug: true, archivedAt: true } } },
      },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { actor: { select: { name: true } } },
      },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      refund: true,
    },
  });
}

const CSV_LIMIT = 5000;

/** CSV of the filtered list (same filters as the table), newest first. */
export async function exportOrdersCsv(
  db: Db,
  actor: Actor,
  f: OrderFilters,
): Promise<{ csv: string; count: number }> {
  assertCan(actor, "orders.export");
  const rows = await db.order.findMany({
    where: orderWhere(f),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: CSV_LIMIT,
    include: { items: { select: { quantity: true } } },
  });
  const csv = toCsv(
    [
      "Order number",
      "Created (UTC)",
      "Payment",
      "Fulfilment",
      "Customer name",
      "Email",
      "City",
      "Country",
      "Items",
      "Subtotal",
      "Shipping",
      "Total",
      "Currency",
      "Carrier",
      "Tracking number",
    ],
    rows.map((o) => [
      o.orderNumber,
      o.createdAt.toISOString(),
      PAYMENT_LABELS[o.status as PaymentStatus],
      FULFILMENT_LABELS[o.fulfilmentStatus as FulfilmentStatus],
      o.customerName,
      o.email,
      o.city,
      countryName(o.country),
      o.items.reduce((n, i) => n + i.quantity, 0),
      (o.subtotalCents / 100).toFixed(2),
      (o.shippingCents / 100).toFixed(2),
      (o.totalCents / 100).toFixed(2),
      o.currency,
      o.carrier ?? "",
      o.trackingNumber ?? "",
    ]),
  );
  await db.$transaction((tx) =>
    writeAudit(tx, {
      actorId: actor.id,
      action: "order.export_csv",
      entityType: "Order",
      summary: { count: rows.length, filters: { ...f, q: f.q ? "[search]" : undefined } },
    }),
  );
  return { csv, count: rows.length };
}

// ---------------------------------------------------------------------------
// Fulfilment
// ---------------------------------------------------------------------------

const STEP_MESSAGES: Record<FulfilmentStatus, string> = {
  unfulfilled: "",
  packed: "Marked as packed",
  shipped: "Marked as shipped",
  delivered: "Marked as delivered",
};

const TRANSITION_ERRORS = {
  NOT_PAID: "Only paid orders can be fulfilled.",
  INVALID_STEP: "This order has already moved on. Reload to see its current status.",
  TRACKING_REQUIRED: "Enter the carrier and the tracking number.",
} as const;

export async function advanceFulfilment(
  db: Db,
  actor: Actor,
  orderId: string,
  to: FulfilmentStatus,
  shipping?: { carrier?: string; trackingNumber?: string },
  onShipped?: (orderId: string) => Promise<unknown>,
) {
  assertCan(actor, "orders.fulfil");
  const carrier = shipping?.carrier?.trim().slice(0, 60) ?? "";
  const trackingNumber = shipping?.trackingNumber?.trim().slice(0, 60) ?? "";
  const res = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, fulfilmentStatus: true },
    });
    if (!order) return fail("That order no longer exists.");
    const check = checkFulfilmentTransition(
      {
        status: order.status as PaymentStatus,
        fulfilmentStatus: order.fulfilmentStatus as FulfilmentStatus,
      },
      to,
      { carrier, trackingNumber },
    );
    if (!check.ok) return fail(TRANSITION_ERRORS[check.reason]);
    const now = new Date();
    const updated = await tx.order.updateMany({
      // Conditional on the current step: two clicks can't both advance it.
      where: { id: orderId, status: "paid", fulfilmentStatus: order.fulfilmentStatus },
      data: {
        fulfilmentStatus: to,
        ...(to === "packed" ? { packedAt: now } : {}),
        ...(to === "shipped" ? { shippedAt: now, carrier, trackingNumber } : {}),
        ...(to === "delivered" ? { deliveredAt: now } : {}),
      },
    });
    if (updated.count !== 1) return fail(TRANSITION_ERRORS.INVALID_STEP);
    await addOrderEvent(tx, {
      orderId,
      type: to,
      message:
        to === "shipped"
          ? `${STEP_MESSAGES[to]} with ${carrier} (${trackingNumber})`
          : STEP_MESSAGES[to],
      actorId: actor.id,
      now,
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: `order.${to}`,
      entityType: "Order",
      entityId: orderId,
      summary: { fulfilment: [order.fulfilmentStatus, to] },
    });
    return { ok: true as const };
  });
  if (res.ok && to === "shipped" && onShipped) {
    // The email is a side effect after commit; a failure is logged, not fatal.
    await onShipped(orderId).catch((err) => logError("admin-orders", "shipped email failed", err));
  }
  return res;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(db: Db, actor: Actor, orderId: string, body: string) {
  assertCan(actor, "orders.note");
  const text = body.trim();
  if (text.length < 1) return fail("Write a note first.");
  if (text.length > 1000) return fail("Notes can be up to 1,000 characters.");
  return db.$transaction(async (tx) => {
    const exists = await tx.order.count({ where: { id: orderId } });
    if (!exists) return fail("That order no longer exists.");
    const note = await tx.orderNote.create({ data: { orderId, authorId: actor.id, body: text } });
    // The note text may mention the customer, so only its length is audited.
    await writeAudit(tx, {
      actorId: actor.id,
      action: "order.note_add",
      entityType: "Order",
      entityId: orderId,
      summary: { noteId: note.id, length: text.length },
    });
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Cancel (pending orders) and refund (paid orders) — admin only
// ---------------------------------------------------------------------------

export async function cancelOrder(
  db: Db,
  actor: Actor,
  orderId: string,
  provider: PaymentProvider,
) {
  assertCan(actor, "orders.cancel");
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, providerSessionId: true },
  });
  if (!order) return fail("That order no longer exists.");
  if (!canCancel({ status: order.status as PaymentStatus })) {
    return fail("Only orders waiting for payment can be cancelled. Refund paid orders instead.");
  }
  const released = await db.$transaction(async (tx) => {
    const ok = await releaseOrderInTx(tx, orderId, "cancelled");
    if (ok) {
      await addOrderEvent(tx, {
        orderId,
        type: "note",
        message: "Cancelled from the admin",
        actorId: actor.id,
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "order.cancel",
        entityType: "Order",
        entityId: orderId,
        summary: { status: ["pending_payment", "cancelled"] },
      });
    }
    return ok;
  });
  if (!released) return fail("This order is no longer waiting for payment.");
  if (order.providerSessionId) await provider.cancelSession(order.providerSessionId);
  return { ok: true as const };
}

const REFUND_ERRORS = {
  NOT_PAID: "Only paid orders can be refunded.",
  ALREADY_REFUNDED: "This order has already been refunded.",
  NO_PAYMENT_REFERENCE: "This order has no payment reference to refund.",
} as const;

/**
 * Full refund. The provider is called first (idempotent per order), then the
 * order is marked refunded in one transaction with the optional restock.
 */
export async function refundOrder(
  db: Db,
  actor: Actor,
  orderId: string,
  opts: { restock: boolean },
  provider: PaymentProvider,
  onRefunded?: (orderId: string) => Promise<unknown>,
) {
  assertCan(actor, "orders.refund");
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      provider: true,
      providerSessionId: true,
      totalCents: true,
      currency: true,
      refund: { select: { id: true } },
      items: { select: { productId: true, quantity: true } },
    },
  });
  if (!order) return fail("That order no longer exists.");
  const check = checkRefund({
    status: order.status as PaymentStatus,
    providerSessionId: order.providerSessionId,
    hasRefund: !!order.refund,
  });
  if (!check.ok) return fail(REFUND_ERRORS[check.reason]);
  if (order.provider !== provider.name) {
    return fail(
      `This order was paid with the ${order.provider} provider, which is not the one configured now.`,
    );
  }

  let refundId: string;
  try {
    ({ refundId } = await provider.refundPayment({
      orderId,
      sessionId: order.providerSessionId!,
      amountCents: order.totalCents,
      currency: order.currency,
    }));
  } catch (err) {
    logError("admin-orders", "refund failed at the provider", err);
    return fail(
      "The payment provider did not accept the refund. Nothing was changed; try again later.",
    );
  }

  const res = await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: "paid" },
      data: { status: "refunded", refundedAt: new Date() },
    });
    if (updated.count !== 1) return fail(REFUND_ERRORS.ALREADY_REFUNDED);
    await tx.refund.create({
      data: {
        orderId,
        amountCents: order.totalCents,
        currency: order.currency,
        provider: provider.name,
        providerRefundId: refundId,
        restocked: opts.restock,
        actorId: actor.id,
      },
    });
    if (opts.restock) {
      for (const item of order.items) {
        await applyStockChange(tx, {
          productId: item.productId,
          delta: item.quantity,
          reason: "refund_restock",
          orderId,
          actorId: actor.id,
        });
      }
    }
    await addOrderEvent(tx, {
      orderId,
      type: "refunded",
      message: `Full refund issued (${provider.name})${opts.restock ? "; items restocked" : "; not restocked"}`,
      actorId: actor.id,
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "order.refund",
      entityType: "Order",
      entityId: orderId,
      summary: {
        amountCents: order.totalCents,
        currency: order.currency,
        provider: provider.name,
        restock: opts.restock,
        status: ["paid", "refunded"],
      },
    });
    return { ok: true as const };
  });
  if (res.ok && onRefunded) {
    await onRefunded(orderId).catch((err) => logError("admin-orders", "refund email failed", err));
  }
  return res;
}
