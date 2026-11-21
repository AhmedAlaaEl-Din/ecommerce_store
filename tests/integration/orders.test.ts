import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addItem } from "@/lib/cart/service";
import { validateCheckout, type CheckoutCustomer } from "@/lib/orders/checkout-schema";
import {
  attachProviderSession,
  createPendingOrder,
  expireStaleOrders,
  getOrderByToken,
  ORDER_NUMBER_RE,
  PUBLIC_TOKEN_RE,
  releaseOrder,
  RESERVATION_MINUTES,
} from "@/lib/orders/service";
import { buildSessionEvent, signPayload, WebhookSignatureError } from "@/lib/payments/events";
import { applyPaymentEvent, handleWebhook, WebhookRetryError } from "@/lib/payments/webhook";
import { makeFixtures, resetDb, testDb, TEST_DB_URL } from "./helpers";
import { execFile } from "node:child_process";
import { join } from "node:path";

const db = testDb();
let f: Awaited<ReturnType<typeof makeFixtures>>;

const customer: CheckoutCustomer = {
  email: "mona@example.com",
  name: "Mona Example",
  addressLine1: "12 Reed Lane",
  addressLine2: "",
  city: "Delta Town",
  postalCode: "DT 1024",
  country: "EG",
};

const SECRET = "integration-test-secret";
const TSX_CLI = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const WORKER = join(process.cwd(), "tests", "integration", "fixtures", "checkout-worker.ts");

beforeEach(async () => {
  await resetDb(db);
  f = await makeFixtures(db);
});

afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

async function cartWith(...lines: Array<[string, number]>) {
  let cartId: string | null = null;
  for (const [productId, qty] of lines) {
    const r = await addItem(db, cartId, productId, qty);
    if (!r.ok) throw new Error(r.code);
    cartId = r.data.cartId;
  }
  return cartId!;
}

async function stockOf(id: string) {
  return (await db.product.findUniqueOrThrow({ where: { id } })).stock;
}

/** Creates a pending order with a session attached, like the checkout action does. */
async function pendingOrder(cartId: string, now = new Date()) {
  const r = await createPendingOrder(db, { cartId, customer, provider: "mock", now });
  if (!r.ok) throw new Error(r.code);
  const sessionId = `mock_cs_${r.order.id}`;
  await attachProviderSession(db, r.order.id, sessionId);
  return { ...r.order, sessionId };
}

function event(
  type: string,
  order: { id: string; sessionId: string },
  id = `evt_${Math.random()}`,
) {
  return {
    id,
    type,
    sessionId: order.sessionId,
    orderId: order.id,
    paymentStatus: type === "checkout.session.completed" ? "paid" : null,
    amountTotal: null as number | null,
    currency: null as string | null,
    livemode: false as boolean | null,
  };
}

describe("createPendingOrder (reservation)", () => {
  it("reserves stock and creates a pending order with server-side totals", async () => {
    const cartId = await cartWith([f.plenty.id, 2], [f.scarce.id, 1]);
    const now = new Date("2026-11-21T10:00:00Z");
    const r = await createPendingOrder(db, { cartId, customer, provider: "mock", now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(await stockOf(f.plenty.id)).toBe(8);
    expect(await stockOf(f.scarce.id)).toBe(1);

    const order = await db.order.findUniqueOrThrow({
      where: { id: r.order.id },
      include: { items: true },
    });
    expect(order.status).toBe("pending_payment");
    expect(order.orderNumber).toMatch(ORDER_NUMBER_RE);
    expect(order.orderNumber).toBe("NG-2026-000001");
    expect(order.publicToken).toMatch(PUBLIC_TOKEN_RE);
    expect(order.subtotalCents).toBe(2 * 1250 + 4000);
    expect(order.shippingCents).toBe(0); // 65.00 >= 50.00
    expect(order.totalCents).toBe(6500);
    expect(order.reservedUntil.getTime() - now.getTime()).toBe(RESERVATION_MINUTES * 60_000);
    expect(
      order.items.map((i) => [
        i.productNameSnapshot,
        i.unitPriceCentsSnapshot,
        i.quantity,
        i.lineTotalCents,
      ]),
    ).toEqual([
      ["Plenty", 1250, 2, 2500],
      ["Scarce", 4000, 1, 4000],
    ]);
    // The cart is kept until payment succeeds.
    expect(await db.cartItem.count({ where: { cartId } })).toBe(2);
  });

  it("numbers orders sequentially and charges flat shipping below $50", async () => {
    const a = await pendingOrder(await cartWith([f.plenty.id, 1]));
    const b = await pendingOrder(await cartWith([f.plenty.id, 1]));
    expect(b.orderNumber.slice(-6)).toBe(
      String(Number(a.orderNumber.slice(-6)) + 1).padStart(6, "0"),
    );
    const order = await db.order.findUniqueOrThrow({ where: { id: b.id } });
    expect(order.shippingCents).toBe(595);
    expect(order.totalCents).toBe(1250 + 595);
  });

  it("refuses an empty or missing cart", async () => {
    expect(await createPendingOrder(db, { cartId: null, customer, provider: "mock" })).toEqual({
      ok: false,
      code: "EMPTY_CART",
    });
    const cartId = await cartWith([f.plenty.id, 1]);
    await db.cartItem.deleteMany({ where: { cartId } });
    expect(await createPendingOrder(db, { cartId, customer, provider: "mock" })).toEqual({
      ok: false,
      code: "EMPTY_CART",
    });
  });

  it("returns the shopper to the cart with adjusted quantities when stock ran out", async () => {
    const cartId = await cartWith([f.scarce.id, 2], [f.plenty.id, 1]);
    await db.product.update({ where: { id: f.scarce.id }, data: { stock: 1 } });

    const r = await createPendingOrder(db, { cartId, customer, provider: "mock" });
    expect(r).toEqual({
      ok: false,
      code: "STOCK_CHANGED",
      changes: [{ productId: f.scarce.id, name: "Scarce", requested: 2, available: 1 }],
    });
    // Nothing was reserved or created.
    expect(await stockOf(f.scarce.id)).toBe(1);
    expect(await stockOf(f.plenty.id)).toBe(10);
    expect(await db.order.count()).toBe(0);
    // Cart now matches what is available.
    const line = await db.cartItem.findFirstOrThrow({ where: { cartId, productId: f.scarce.id } });
    expect(line.quantity).toBe(1);
  });

  it("removes lines that sold out completely", async () => {
    const cartId = await cartWith([f.scarce.id, 1]);
    await db.product.update({ where: { id: f.scarce.id }, data: { stock: 0 } });
    const r = await createPendingOrder(db, { cartId, customer, provider: "mock" });
    expect(r.ok).toBe(false);
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0);
  });

  it(
    "race: two checkouts in two separate processes for the last units, exactly one wins",
    { timeout: 60_000 },
    async () => {
      const cartA = await cartWith([f.scarce.id, 2]);
      const cartB = await cartWith([f.scarce.id, 2]);
      const startAt = Date.now() + 4000; // both processes start their checkout at this moment
      const run = (cartId: string, email: string) =>
        new Promise<{ ok: boolean; code?: string; message?: string }>((resolve, reject) => {
          execFile(
            process.execPath,
            [TSX_CLI, WORKER, cartId, String(startAt), email],
            { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: TEST_DB_URL } },
            (err, stdout) => {
              try {
                resolve(JSON.parse(stdout));
              } catch {
                reject(err ?? new Error(`worker output: ${stdout}`));
              }
            },
          );
        });
      const results = await Promise.all([
        run(cartA, "mona@example.com"),
        run(cartB, "omar@example.com"),
      ]);
      expect(
        results.filter((r) => r.ok),
        JSON.stringify(results),
      ).toHaveLength(1);
      expect(
        results.filter((r) => !r.ok && r.code === "STOCK_CHANGED"),
        JSON.stringify(results),
      ).toHaveLength(1);
      expect(await stockOf(f.scarce.id)).toBe(0);
      expect(await db.order.count()).toBe(1);
    },
  );

  it("race on one connection: ten shoppers, two units, two orders", async () => {
    const carts = await Promise.all(Array.from({ length: 10 }, () => cartWith([f.scarce.id, 1])));
    const results = await Promise.all(
      carts.map((cartId) => createPendingOrder(db, { cartId, customer, provider: "mock" })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(await stockOf(f.scarce.id)).toBe(0);
  });

  it("ignores price tampering: only product ids and quantities come from the cart", async () => {
    const cartId = await cartWith([f.plenty.id, 1]);
    // The price changes after the item was added: checkout uses the current DB price.
    await db.product.update({ where: { id: f.plenty.id }, data: { priceCents: 1400 } });
    const order = await pendingOrder(cartId);
    const stored = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.subtotalCents).toBe(1400);

    // Extra form fields such as a total or a price are dropped by the schema.
    const v = validateCheckout({
      ...customer,
      totalCents: "1",
      priceCents: "1",
      status: "paid",
    } as unknown as Parameters<typeof validateCheckout>[0]);
    expect(v.ok).toBe(true);
    if (v.ok) expect(Object.keys(v.data).sort()).toEqual(Object.keys(customer).sort());
  });
});

describe("payment transitions", () => {
  it("paid: marks the order paid, keeps the stock taken and clears the cart", async () => {
    const cartId = await cartWith([f.scarce.id, 2]);
    const order = await pendingOrder(cartId);
    const out = await applyPaymentEvent(db, event("checkout.session.completed", order));
    expect(out).toMatchObject({ status: "processed", action: "paid", paid: "paid" });
    const stored = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("paid");
    expect(stored.paidAt).not.toBeNull();
    expect(await stockOf(f.scarce.id)).toBe(0);
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0);
  });

  it("completed but unpaid (delayed method) waits for the async result", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    const out = await applyPaymentEvent(db, {
      ...event("checkout.session.completed", order),
      paymentStatus: "unpaid",
    });
    expect(out).toMatchObject({ action: "ignored" });
    const later = await applyPaymentEvent(
      db,
      event("checkout.session.async_payment_succeeded", order),
    );
    expect(later).toMatchObject({ action: "paid" });
  });

  it("failed: releases the stock and keeps the cart", async () => {
    const cartId = await cartWith([f.scarce.id, 2]);
    const order = await pendingOrder(cartId);
    expect(await stockOf(f.scarce.id)).toBe(0);
    const out = await applyPaymentEvent(db, event("payment_failed", order));
    expect(out).toMatchObject({ action: "released", released: true });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "payment_failed",
    );
    expect(await stockOf(f.scarce.id)).toBe(2);
    expect(await db.cartItem.count({ where: { cartId } })).toBe(1);
  });

  it("stripe async failure and session expiry release the stock", async () => {
    const a = await pendingOrder(await cartWith([f.plenty.id, 3]));
    const b = await pendingOrder(await cartWith([f.plenty.id, 2]));
    expect(await stockOf(f.plenty.id)).toBe(5);
    await applyPaymentEvent(db, event("checkout.session.async_payment_failed", a));
    await applyPaymentEvent(db, event("checkout.session.expired", b));
    expect((await db.order.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "payment_failed",
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("expired");
    expect(await stockOf(f.plenty.id)).toBe(10);
  });

  it("cancelled: releases once, even if cancelled twice", async () => {
    const order = await pendingOrder(await cartWith([f.scarce.id, 1]));
    expect(await releaseOrder(db, order.id, "cancelled")).toBe(true);
    expect(await releaseOrder(db, order.id, "cancelled")).toBe(false);
    expect(await releaseOrder(db, order.id, "expired")).toBe(false);
    expect(await stockOf(f.scarce.id)).toBe(2);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "cancelled",
    );
  });

  it("expiry releases only reservations that have passed", async () => {
    const t0 = new Date("2026-11-21T10:00:00Z");
    const old = await pendingOrder(await cartWith([f.plenty.id, 4]), t0);
    const fresh = await pendingOrder(
      await cartWith([f.plenty.id, 1]),
      new Date(t0.getTime() + 20 * 60_000),
    );
    expect(await stockOf(f.plenty.id)).toBe(5);

    const at = new Date(t0.getTime() + (RESERVATION_MINUTES + 1) * 60_000);
    expect(await expireStaleOrders(db, at)).toBe(1);
    expect(await expireStaleOrders(db, at)).toBe(0); // idempotent
    expect((await db.order.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("expired");
    expect((await db.order.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe(
      "pending_payment",
    );
    expect(await stockOf(f.plenty.id)).toBe(9);
  });

  it("a new checkout first expires stale reservations, freeing their stock", async () => {
    const t0 = new Date("2026-11-21T10:00:00Z");
    const secondCart = await cartWith([f.scarce.id, 2]);
    await pendingOrder(await cartWith([f.scarce.id, 2]), t0);
    expect(await stockOf(f.scarce.id)).toBe(0);
    const later = new Date(t0.getTime() + 31 * 60_000);
    const r = await createPendingOrder(db, {
      cartId: secondCart,
      customer,
      provider: "mock",
      now: later,
    });
    expect(r.ok).toBe(true);
  });

  it("a payment that arrives after expiry takes the stock again, or flags an oversell", async () => {
    const t0 = new Date("2026-11-21T10:00:00Z");
    const late = await pendingOrder(await cartWith([f.scarce.id, 1]), t0);
    await expireStaleOrders(db, new Date(t0.getTime() + 31 * 60_000));
    expect(await stockOf(f.scarce.id)).toBe(2);
    expect(await applyPaymentEvent(db, event("checkout.session.completed", late))).toMatchObject({
      paid: "paid_after_release",
    });
    expect(await stockOf(f.scarce.id)).toBe(1);

    const gone = await pendingOrder(await cartWith([f.plenty.id, 1]), t0);
    await expireStaleOrders(db, new Date(t0.getTime() + 31 * 60_000));
    await db.product.update({ where: { id: f.plenty.id }, data: { stock: 0 } });
    expect(await applyPaymentEvent(db, event("checkout.session.completed", gone))).toMatchObject({
      paid: "paid_oversold",
    });
    expect(await stockOf(f.plenty.id)).toBe(0); // never negative
  });

  it("ignores events whose session id does not match the order (signed but wrong order)", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    const out = await applyPaymentEvent(db, {
      ...event("checkout.session.completed", order),
      sessionId: "cs_other",
    });
    expect(out).toMatchObject({ action: "ignored" });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "pending_payment",
    );
    const unknown = await applyPaymentEvent(db, {
      ...event("checkout.session.completed", order),
      orderId: "nope",
    });
    expect(unknown).toMatchObject({ action: "ignored" });
  });
});

describe("idempotency", () => {
  it("a duplicate event is acknowledged and does nothing", async () => {
    const order = await pendingOrder(await cartWith([f.scarce.id, 2]));
    const e = event("payment_failed", order, "evt_dup_1");
    expect(await applyPaymentEvent(db, e)).toMatchObject({ action: "released" });
    expect(await applyPaymentEvent(db, e)).toEqual({ status: "duplicate" });
    expect(await stockOf(f.scarce.id)).toBe(2); // released once, not twice
    expect(await db.processedEvent.count()).toBe(1);
  });

  it("a second, different paid event for the same order is a no-op", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    await applyPaymentEvent(db, event("checkout.session.completed", order, "evt_a"));
    expect(
      await applyPaymentEvent(db, event("checkout.session.completed", order, "evt_b")),
    ).toMatchObject({
      paid: "already_paid",
    });
    expect(await stockOf(f.plenty.id)).toBe(9);
  });

  it("a failure after payment does not release a paid order", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    await applyPaymentEvent(db, event("checkout.session.completed", order));
    expect(await applyPaymentEvent(db, event("checkout.session.expired", order))).toMatchObject({
      released: false,
    });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("paid");
    expect(await stockOf(f.plenty.id)).toBe(9);
  });
});

describe("handleWebhook (signature + handling + side effect)", () => {
  it("verifies, applies and calls onPaid exactly once across duplicate deliveries", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    const payload = buildSessionEvent({
      eventId: "evt_hook_1",
      type: "checkout.session.completed",
      sessionId: order.sessionId,
      orderId: order.id,
      paymentStatus: "paid",
    });
    const onPaid = vi.fn(async () => {});
    const deps = { db, secret: SECRET, onPaid };
    expect(await handleWebhook(payload, signPayload(payload, SECRET), deps)).toMatchObject({
      action: "paid",
    });
    expect(await handleWebhook(payload, signPayload(payload, SECRET), deps)).toEqual({
      status: "duplicate",
    });
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(order.id);
  });

  it("rejects a forged event before touching the database", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    const payload = buildSessionEvent({
      eventId: "evt_forged",
      type: "checkout.session.completed",
      sessionId: order.sessionId,
      orderId: order.id,
      paymentStatus: "paid",
    });
    await expect(
      handleWebhook(payload, signPayload(payload, "attacker"), { db, secret: SECRET }),
    ).rejects.toThrow(WebhookSignatureError);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "pending_payment",
    );
    expect(await db.processedEvent.count()).toBe(0);
  });

  it("a failing side effect does not fail the webhook", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    const payload = buildSessionEvent({
      eventId: "evt_side",
      type: "checkout.session.completed",
      sessionId: order.sessionId,
      orderId: order.id,
      paymentStatus: "paid",
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await handleWebhook(payload, signPayload(payload, SECRET), {
      db,
      secret: SECRET,
      onPaid: async () => {
        throw new Error("disk full");
      },
    });
    spy.mockRestore();
    expect(out).toMatchObject({ action: "paid" });
  });
});

describe("getOrderByToken", () => {
  it("finds by token only, and rejects malformed tokens without a query", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    expect((await getOrderByToken(db, order.publicToken))?.id).toBe(order.id);
    expect(await getOrderByToken(db, order.id)).toBeNull();
    expect(await getOrderByToken(db, "x".repeat(32))).toBeNull();
    expect(await getOrderByToken(db, "../../etc")).toBeNull();
  });
});

describe("security review fixes", () => {
  it("a resubmit from the same cart replaces the earlier pending order (no double hold)", async () => {
    const cartId = await cartWith([f.scarce.id, 2]);
    const first = await pendingOrder(cartId);
    expect(await stockOf(f.scarce.id)).toBe(0);
    const again = await createPendingOrder(db, { cartId, customer, provider: "mock" });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.supersededSessionIds).toEqual([first.sessionId]);
    expect((await db.order.findUniqueOrThrow({ where: { id: first.id } })).status).toBe(
      "cancelled",
    );
    expect(await stockOf(f.scarce.id)).toBe(0); // held once, by the new order
    expect(await db.order.count({ where: { status: "pending_payment" } })).toBe(1);
  });

  it("refuses to mark paid when the charged amount or currency differs", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    const base = event("checkout.session.completed", order);
    expect(await applyPaymentEvent(db, { ...base, amountTotal: 1 })).toMatchObject({
      action: "ignored",
      reason: "amount or currency mismatch",
    });
    expect(
      await applyPaymentEvent(db, { ...base, id: "evt_cur", amountTotal: 1845, currency: "eur" }),
    ).toMatchObject({ action: "ignored" });
    expect(
      await applyPaymentEvent(db, { ...base, id: "evt_ok", amountTotal: 1845, currency: "usd" }),
    ).toMatchObject({ action: "paid" });
  });

  it("refuses live-mode events", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    expect(
      await applyPaymentEvent(db, {
        ...event("checkout.session.completed", order),
        livemode: true,
      }),
    ).toMatchObject({ action: "ignored", reason: "live-mode event refused" });
  });

  it("unmatched events are not recorded; an event before the session is stored asks for a retry", async () => {
    const order = await pendingOrder(await cartWith([f.plenty.id, 1]));
    await applyPaymentEvent(db, {
      ...event("checkout.session.completed", order, "evt_wrong"),
      sessionId: "cs_other",
    });
    expect(await db.processedEvent.count()).toBe(0);

    const r = await createPendingOrder(db, {
      cartId: await cartWith([f.plenty.id, 1]),
      customer,
      provider: "mock",
    });
    if (!r.ok) throw new Error("setup");
    await expect(
      applyPaymentEvent(db, {
        ...event("checkout.session.completed", { id: r.order.id, sessionId: "cs_x" }),
      }),
    ).rejects.toThrow(WebhookRetryError);
  });

  it("paying removes only the purchased quantities from the cart", async () => {
    const cartId = await cartWith([f.plenty.id, 2]);
    const order = await pendingOrder(cartId);
    // Shopper keeps shopping while the payment is pending.
    await addItem(db, cartId, f.plenty.id, 1);
    await addItem(db, cartId, f.scarce.id, 1);
    await applyPaymentEvent(db, event("checkout.session.completed", order));
    const left = await db.cartItem.findMany({ where: { cartId }, orderBy: { productId: "asc" } });
    expect(left.map((l) => [l.productId, l.quantity]).sort()).toEqual(
      [
        [f.plenty.id, 1],
        [f.scarce.id, 1],
      ].sort(),
    );
  });

  it("late and oversold payments are flagged on the order", async () => {
    const t0 = new Date("2026-11-21T10:00:00Z");
    const late = await pendingOrder(await cartWith([f.plenty.id, 1]), t0);
    await expireStaleOrders(db, new Date(t0.getTime() + 31 * 60_000));
    await applyPaymentEvent(db, event("checkout.session.completed", late));
    expect((await db.order.findUniqueOrThrow({ where: { id: late.id } })).fulfilmentNote).toBe(
      "paid_after_release",
    );
  });
});
