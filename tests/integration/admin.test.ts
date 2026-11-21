/**
 * Phase 3 integration tests against prisma/test.db (no Next.js runtime, no network).
 */
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPermissionError, type Actor } from "@/lib/admin/actor";
import { login, loginLimits, logout, resolveSession } from "@/lib/admin/auth-service";
import { createCategory, deleteCategory } from "@/lib/admin/categories";
import { getDashboard } from "@/lib/admin/dashboard";
import { hashPassword } from "@/lib/admin/password";
import {
  exportOrdersCsv,
  addNote,
  advanceFulfilment,
  cancelOrder,
  refundOrder,
} from "@/lib/admin/orders";
import {
  adjustStock,
  bulkSetStock,
  createProduct,
  deleteProduct,
  productFormSchema,
  setArchived,
  updateProduct,
} from "@/lib/admin/products";
import {
  hashSessionToken,
  LOCKOUT_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
} from "@/lib/admin/session-rules";
import { changeRole, inviteUser, setUserActive } from "@/lib/admin/users";
import { setLowStockThreshold } from "@/lib/admin/inventory";
import { addItem } from "@/lib/cart/service";
import type { CheckoutCustomer } from "@/lib/orders/checkout-schema";
import { writeNoticeEmail } from "@/lib/orders/outbox";
import {
  attachProviderSession,
  createPendingOrder,
  expireStaleOrders,
  markOrderPaidInTx,
  releaseOrder,
} from "@/lib/orders/service";
import { MockProvider } from "@/lib/payments/mock";
import type { PaymentProvider } from "@/lib/payments/types";
import { makeFixtures, resetDb, testDb } from "./helpers";

const db = testDb();
const OUTBOX = join(process.cwd(), "var", "outbox-integration");
const PASSWORD = "integration-pass-2026";
let f: Awaited<ReturnType<typeof makeFixtures>>;
let admin: Actor;
let staff: Actor;

const customer: CheckoutCustomer = {
  email: "omar@example.com",
  name: "Omar Example",
  addressLine1: "7 Papyrus Road",
  addressLine2: "",
  city: "Oasis Bay",
  postalCode: "OB 2040",
  country: "AE",
};

beforeAll(async () => {
  process.env.OUTBOX_DIR = "var/outbox-integration";
  rmSync(OUTBOX, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetDb(db);
  f = await makeFixtures(db);
  loginLimits.ip.clear();
  loginLimits.account.clear();
  const passwordHash = await hashPassword(PASSWORD);
  const a = await db.adminUser.create({
    data: { email: "admin@example.com", name: "Test Admin", role: "admin", passwordHash },
  });
  const s = await db.adminUser.create({
    data: { email: "staff@example.com", name: "Test Staff", role: "staff", passwordHash },
  });
  admin = { id: a.id, role: "admin" };
  staff = { id: s.id, role: "staff" };
});

afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
  rmSync(OUTBOX, { recursive: true, force: true });
});

async function paidOrder(lines: Array<[string, number]>, now = new Date()) {
  let cartId: string | null = null;
  for (const [productId, qty] of lines) {
    const r = await addItem(db, cartId, productId, qty);
    if (!r.ok) throw new Error(r.code);
    cartId = r.data.cartId;
  }
  const res = await createPendingOrder(db, { cartId, customer, provider: "mock", now });
  if (!res.ok) throw new Error(res.code);
  await attachProviderSession(
    db,
    res.order.id,
    "mock_cs_" + "x".repeat(20) + Math.random().toString(36).slice(2, 8),
  );
  await db.$transaction((tx) => markOrderPaidInTx(tx, res.order.id, now));
  return res.order.id;
}

async function stockSumMatches(productId: string) {
  const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
  const sum = await db.stockMovement.aggregate({ where: { productId }, _sum: { delta: true } });
  return { stock: p.stock, sum: sum._sum.delta ?? 0 };
}

/** The fixtures create products without opening movements; give them one. */
async function openingBalances() {
  for (const p of await db.product.findMany()) {
    if (p.stock > 0) {
      await db.stockMovement.create({
        data: { productId: p.id, delta: p.stock, reason: "initial", stockAfter: p.stock },
      });
    }
  }
}

// ---------------------------------------------------------------------------
describe("login, lockout and sessions", () => {
  it("signs in with the right password and stores only the token hash", async () => {
    const res = await login(db, {
      email: " Admin@Example.com ",
      password: PASSWORD,
      ip: "1.1.1.1",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(await db.adminSession.count({ where: { id: res.token } })).toBe(0);
    expect(await db.adminSession.count({ where: { id: hashSessionToken(res.token) } })).toBe(1);
    const ctx = await resolveSession(db, res.token);
    expect(ctx?.user).toMatchObject({ email: "admin@example.com", role: "admin" });
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "auth.login_success" } });
    expect(audit.summary).toContain("a***@e***.com");
    expect(audit.summary).not.toContain("admin@example.com");
  });

  it("gives the same answer for a wrong password, an unknown email and a disabled account", async () => {
    await db.adminUser.update({ where: { id: staff.id }, data: { isActive: false } });
    const wrong = await login(db, {
      email: "admin@example.com",
      password: "nope-nope-nope",
      ip: "1.1.1.2",
    });
    const unknown = await login(db, {
      email: "nobody@example.com",
      password: PASSWORD,
      ip: "1.1.1.2",
    });
    const disabled = await login(db, {
      email: "staff@example.com",
      password: PASSWORD,
      ip: "1.1.1.2",
    });
    expect(wrong).toEqual({ ok: false, code: "INVALID" });
    expect(unknown).toEqual({ ok: false, code: "INVALID" });
    expect(disabled).toEqual({ ok: false, code: "INVALID" });
    const failed = await db.auditLog.findMany({ where: { action: "auth.login_failed" } });
    expect(failed).toHaveLength(3);
    for (const a of failed) expect(a.summary).not.toMatch(/[\w.]+@example\.com/);
  });

  it("locks the account for 15 minutes after 5 failures, even for the right password", async () => {
    const t0 = new Date("2026-11-21T09:00:00Z");
    for (let i = 0; i < 5; i++) {
      await login(db, {
        email: "admin@example.com",
        password: `wrong-${i}-password`,
        ip: `2.2.2.${i}`,
        now: t0,
      });
    }
    const u = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    expect(u.lockedUntil?.getTime()).toBe(t0.getTime() + LOCKOUT_MS);
    expect(await db.auditLog.count({ where: { action: "auth.account_locked" } })).toBe(1);
    loginLimits.account.clear();
    const during = await login(db, {
      email: "admin@example.com",
      password: PASSWORD,
      ip: "2.2.2.9",
      now: new Date(t0.getTime() + LOCKOUT_MS - 1000),
    });
    expect(during).toEqual({ ok: false, code: "INVALID" });
    const after = await login(db, {
      email: "admin@example.com",
      password: PASSWORD,
      ip: "2.2.2.9",
      now: new Date(t0.getTime() + LOCKOUT_MS + 1000),
    });
    expect(after.ok).toBe(true);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).failedLogins).toBe(
      0,
    );
  });

  it("rate limits per account and per IP", async () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(
        await login(db, { email: "ghost@example.com", password: "x-x-x-x-x-x", ip: `3.3.3.${i}` }),
      );
    }
    expect(results.slice(0, 8).every((r) => !r.ok && r.code === "INVALID")).toBe(true);
    expect(results[9]).toEqual({ ok: false, code: "THROTTLED" });
    loginLimits.account.clear();
    const ipResults = [];
    for (let i = 0; i < 22; i++) {
      ipResults.push(
        await login(db, { email: `spray${i}@example.com`, password: "x-x-x-x-x-x", ip: "4.4.4.4" }),
      );
    }
    expect(ipResults.at(-1)).toEqual({ ok: false, code: "THROTTLED" });
  });

  it("rotates the session on login and removes it on logout", async () => {
    const first = await login(db, {
      email: "admin@example.com",
      password: PASSWORD,
      ip: "5.5.5.5",
    });
    if (!first.ok) throw new Error("login failed");
    const second = await login(db, {
      email: "admin@example.com",
      password: PASSWORD,
      ip: "5.5.5.5",
      previousToken: first.token,
    });
    if (!second.ok) throw new Error("login failed");
    expect(second.token).not.toBe(first.token);
    expect(await resolveSession(db, first.token)).toBeNull();
    expect(await resolveSession(db, second.token)).not.toBeNull();
    await logout(db, second.token, admin.id);
    expect(await resolveSession(db, second.token)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "auth.logout" } })).toBe(1);
  });

  it("expires after 30 idle minutes and after 12 hours, deleting the row", async () => {
    const t0 = new Date("2026-11-21T08:00:00Z");
    const s = await login(db, {
      email: "staff@example.com",
      password: PASSWORD,
      ip: "6.6.6.6",
      now: t0,
    });
    if (!s.ok) throw new Error("login failed");
    expect(
      await resolveSession(db, s.token, new Date(t0.getTime() + SESSION_IDLE_MS - 1000)),
    ).not.toBeNull();
    // Activity slides the idle window...
    const active = new Date(t0.getTime() + SESSION_IDLE_MS - 1000);
    expect(
      await resolveSession(db, s.token, new Date(active.getTime() + SESSION_IDLE_MS - 1000)),
    ).not.toBeNull();
    // ...until 30 minutes pass without activity.
    expect(
      await resolveSession(db, s.token, new Date(active.getTime() + 3 * SESSION_IDLE_MS)),
    ).toBeNull();
    expect(await db.adminSession.count({ where: { id: hashSessionToken(s.token) } })).toBe(0);

    const t1 = new Date("2026-11-22T08:00:00Z");
    const s2 = await login(db, {
      email: "staff@example.com",
      password: PASSWORD,
      ip: "6.6.6.6",
      now: t1,
    });
    if (!s2.ok) throw new Error("login failed");
    // Keep it busy every 20 minutes for 12 hours: the absolute limit still ends it.
    let t = t1.getTime();
    while (t + 20 * 60_000 < t1.getTime() + SESSION_ABSOLUTE_MS) {
      t += 20 * 60_000;
      expect(await resolveSession(db, s2.token, new Date(t))).not.toBeNull();
    }
    expect(
      await resolveSession(db, s2.token, new Date(t1.getTime() + SESSION_ABSOLUTE_MS)),
    ).toBeNull();
  });

  it("disabling a user signs them out everywhere", async () => {
    const s = await login(db, { email: "staff@example.com", password: PASSWORD, ip: "7.7.7.7" });
    if (!s.ok) throw new Error("login failed");
    expect((await setUserActive(db, admin, staff.id, false)).ok).toBe(true);
    expect(await resolveSession(db, s.token)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("every admin service with each role", () => {
  const product = () =>
    productFormSchema.parse({
      name: "Role Test Mug",
      slug: "",
      shortDescription: "A mug for role tests.",
      description: "A plain stoneware mug used only to test roles.",
      price: "12.00",
      compareAt: "",
      stock: "3",
      categoryId: f.category.id,
      isActive: "on",
      isFeatured: "",
    });

  const cases: Array<{
    name: string;
    staffAllowed: boolean;
    call: (actor: Actor) => Promise<unknown>;
  }> = [
    { name: "createProduct", staffAllowed: false, call: (a) => createProduct(db, a, product()) },
    {
      name: "updateProduct",
      staffAllowed: false,
      call: (a) => updateProduct(db, a, f.plenty.id, { ...product(), slug: "plenty" }),
    },
    {
      name: "setArchived",
      staffAllowed: false,
      call: (a) => setArchived(db, a, f.inactive.id, true),
    },
    { name: "deleteProduct", staffAllowed: false, call: (a) => deleteProduct(db, a, f.soldOut.id) },
    {
      name: "adjustStock",
      staffAllowed: true,
      call: (a) => adjustStock(db, a, { productId: f.plenty.id, delta: 1, reason: "received" }),
    },
    {
      name: "bulkSetStock",
      staffAllowed: true,
      call: (a) => bulkSetStock(db, a, [{ productId: f.plenty.id, stock: 9, expected: 999 }]),
    },
    {
      name: "setLowStockThreshold",
      staffAllowed: false,
      call: (a) => setLowStockThreshold(db, a, 4),
    },
    {
      name: "createCategory",
      staffAllowed: false,
      call: (a) =>
        createCategory(db, a, {
          name: "Garden",
          slug: "garden",
          description: "Things for the garden.",
          accentColor: "#D9E4D6",
        }),
    },
    { name: "deleteCategory", staffAllowed: false, call: (a) => deleteCategory(db, a, "missing") },
    {
      name: "advanceFulfilment",
      staffAllowed: true,
      call: (a) => advanceFulfilment(db, a, "missing", "packed"),
    },
    { name: "addNote", staffAllowed: true, call: (a) => addNote(db, a, "missing", "hello") },
    {
      name: "cancelOrder",
      staffAllowed: false,
      call: (a) => cancelOrder(db, a, "missing", new MockProvider()),
    },
    {
      name: "refundOrder",
      staffAllowed: false,
      call: (a) => refundOrder(db, a, "missing", { restock: false }, new MockProvider()),
    },
    { name: "exportOrdersCsv", staffAllowed: false, call: (a) => exportOrdersCsv(db, a, {}) },
    {
      name: "inviteUser",
      staffAllowed: false,
      call: (a) => inviteUser(db, a, { email: "new@example.com", name: "New", role: "staff" }),
    },
    { name: "changeRole", staffAllowed: false, call: (a) => changeRole(db, a, "missing", "admin") },
    {
      name: "setUserActive",
      staffAllowed: false,
      call: (a) => setUserActive(db, a, "missing", false),
    },
  ];

  for (const c of cases) {
    it(`${c.name}: admin allowed, staff ${c.staffAllowed ? "allowed" : "denied"}`, async () => {
      if (c.staffAllowed) {
        await expect(c.call(staff)).resolves.toBeDefined();
      } else {
        const before = await db.auditLog.count();
        await expect(c.call(staff)).rejects.toBeInstanceOf(AdminPermissionError);
        expect(await db.auditLog.count()).toBe(before);
      }
      await expect(c.call(admin)).resolves.toBeDefined();
    });
  }
});

// ---------------------------------------------------------------------------
describe("products", () => {
  const form = (over: Record<string, string> = {}) =>
    productFormSchema.parse({
      name: "Lotus Bowl",
      slug: "",
      shortDescription: "A shallow lotus bowl.",
      description: "A shallow stoneware bowl glazed like a lotus leaf.",
      price: "24.00",
      compareAt: "",
      stock: "6",
      categoryId: f.category.id,
      isActive: "on",
      isFeatured: "",
      ...over,
    });

  it("creates with an opening stock movement and an audit entry; slugs stay unique", async () => {
    const res = await createProduct(db, admin, form());
    expect(res).toMatchObject({ ok: true, slug: "lotus-bowl" });
    if (!res.ok) return;
    expect(await stockSumMatches(res.id)).toEqual({ stock: 6, sum: 6 });
    expect(await db.auditLog.count({ where: { action: "product.create", entityId: res.id } })).toBe(
      1,
    );
    const dup = await createProduct(db, admin, form());
    expect(dup).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
  });

  it("updates and audits only the changed fields", async () => {
    const res = await updateProduct(db, admin, f.plenty.id, {
      ...form({ name: "Plenty", slug: "plenty", price: "13.00" }),
      stock: 0,
    });
    expect(res.ok).toBe(true);
    const p = await db.product.findUniqueOrThrow({ where: { id: f.plenty.id } });
    expect(p.priceCents).toBe(1300);
    expect(p.stock).toBe(10); // the form never changes stock
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "product.update" } });
    const changes = JSON.parse(audit.summary).changes;
    expect(changes.priceCents).toEqual([1250, 1300]);
    expect(changes.slug).toBeUndefined();
  });

  it("a price change never alters past orders (snapshots)", async () => {
    const orderId = await paidOrder([[f.plenty.id, 2]]);
    const before = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    await updateProduct(
      db,
      admin,
      f.plenty.id,
      form({ name: "Renamed Plenty", slug: "plenty", price: "99.00" }),
    );
    const after = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    expect(after.totalCents).toBe(before.totalCents);
    expect(after.items[0]).toMatchObject({
      productNameSnapshot: "Plenty",
      unitPriceCentsSnapshot: 1250,
      lineTotalCents: 2500,
    });
  });

  it("archives (hidden, out of carts) when ordered; deletes only without orders", async () => {
    await paidOrder([[f.scarce.id, 1]]);
    const cart = await addItem(db, null, f.scarce.id, 1);
    expect(cart.ok).toBe(true);
    const del = await deleteProduct(db, admin, f.scarce.id);
    expect(del).toMatchObject({ ok: false, code: "HAS_ORDERS" });
    expect((await setArchived(db, admin, f.scarce.id, true)).ok).toBe(true);
    const p = await db.product.findUniqueOrThrow({ where: { id: f.scarce.id } });
    expect(p.archivedAt).not.toBeNull();
    expect(p.isActive).toBe(false);
    expect(await db.cartItem.count({ where: { productId: f.scarce.id } })).toBe(0);
    const ok = await deleteProduct(db, admin, f.soldOut.id);
    expect(ok.ok).toBe(true);
    expect(await db.product.count({ where: { id: f.soldOut.id } })).toBe(0);
  });

  it("categories can't be deleted while they have products", async () => {
    const res = await deleteCategory(db, admin, f.category.id);
    expect(res.ok).toBe(false);
    const c = await createCategory(db, admin, {
      name: "Empty",
      slug: "empty",
      description: "No products here.",
      accentColor: "#EEEEEE",
    });
    if (!c.ok) throw new Error("create failed");
    expect((await deleteCategory(db, admin, c.id)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("stock movements", () => {
  it("add up to stock through reservations, releases, payments, adjustments and refunds", async () => {
    await openingBalances();
    const pending = await (async () => {
      const r = await addItem(db, null, f.plenty.id, 3);
      if (!r.ok) throw new Error("cart");
      const o = await createPendingOrder(db, { cartId: r.data.cartId, customer, provider: "mock" });
      if (!o.ok) throw new Error("order");
      return o.order.id;
    })();
    expect(await stockSumMatches(f.plenty.id)).toEqual({ stock: 7, sum: 7 });
    await releaseOrder(db, pending, "cancelled");
    expect(await stockSumMatches(f.plenty.id)).toEqual({ stock: 10, sum: 10 });

    const paid = await paidOrder([
      [f.plenty.id, 2],
      [f.scarce.id, 2],
    ]);
    expect(await stockSumMatches(f.plenty.id)).toEqual({ stock: 8, sum: 8 });
    expect(await stockSumMatches(f.scarce.id)).toEqual({ stock: 0, sum: 0 });

    expect(
      (await adjustStock(db, staff, { productId: f.plenty.id, delta: 5, reason: "received" })).ok,
    ).toBe(true);
    expect(
      (await adjustStock(db, staff, { productId: f.plenty.id, delta: -2, reason: "damaged" })).ok,
    ).toBe(true);
    const tooMany = await adjustStock(db, staff, {
      productId: f.scarce.id,
      delta: -1,
      reason: "damaged",
    });
    expect(tooMany.ok).toBe(false); // never below zero
    expect(await stockSumMatches(f.plenty.id)).toEqual({ stock: 11, sum: 11 });

    await refundOrder(db, admin, paid, { restock: true }, new MockProvider());
    expect(await stockSumMatches(f.plenty.id)).toEqual({ stock: 13, sum: 13 });
    expect(await stockSumMatches(f.scarce.id)).toEqual({ stock: 2, sum: 2 });

    // Expiry after a late payment: released, then taken again on payment.
    const t0 = new Date(Date.now() - 2 * 60 * 60_000);
    const late = await (async () => {
      const r = await addItem(db, null, f.plenty.id, 1);
      if (!r.ok) throw new Error("cart");
      const o = await createPendingOrder(db, {
        cartId: r.data.cartId,
        customer,
        provider: "mock",
        now: t0,
      });
      if (!o.ok) throw new Error("order");
      return o.order.id;
    })();
    await expireStaleOrders(db);
    await db.$transaction((tx) => markOrderPaidInTx(tx, late, new Date()));
    expect(await stockSumMatches(f.plenty.id)).toEqual({ stock: 12, sum: 12 });
    const reasons = (await db.stockMovement.findMany({ where: { productId: f.plenty.id } })).map(
      (m) => m.reason,
    );
    expect(new Set(reasons)).toEqual(
      new Set([
        "initial",
        "reservation",
        "release",
        "received",
        "damaged",
        "refund_restock",
        "sale",
      ]),
    );
  });

  it("bulk edits set counted numbers as corrections and skip rows that changed meanwhile", async () => {
    await openingBalances();
    const res = await bulkSetStock(db, staff, [
      { productId: f.plenty.id, stock: 4, expected: 10 },
      { productId: f.scarce.id, stock: 9, expected: 1 }, // stale: actual is 2
    ]);
    expect(res.value).toEqual({ changed: 1, conflicts: ["Scarce"] });
    expect(await stockSumMatches(f.plenty.id)).toEqual({ stock: 4, sum: 4 });
    expect((await db.product.findUniqueOrThrow({ where: { id: f.scarce.id } })).stock).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe("fulfilment and refunds", () => {
  it("moves unfulfilled -> packed -> shipped (with tracking) -> delivered, one step at a time", async () => {
    const id = await paidOrder([[f.plenty.id, 1]]);
    const shipped = vi.fn(async (orderId: string) => writeNoticeEmail(db, orderId, "shipped"));
    expect(
      (await advanceFulfilment(db, staff, id, "shipped", { carrier: "X", trackingNumber: "Y" })).ok,
    ).toBe(false);
    expect((await advanceFulfilment(db, staff, id, "packed")).ok).toBe(true);
    expect((await advanceFulfilment(db, staff, id, "packed")).ok).toBe(false); // double click
    expect(
      await advanceFulfilment(db, staff, id, "shipped", { carrier: " ", trackingNumber: "" }),
    ).toMatchObject({ ok: false });
    expect(
      (
        await advanceFulfilment(
          db,
          staff,
          id,
          "shipped",
          { carrier: "Nile Post", trackingNumber: "NP123" },
          shipped,
        )
      ).ok,
    ).toBe(true);
    expect(shipped).toHaveBeenCalledTimes(1);
    expect((await advanceFulfilment(db, staff, id, "delivered")).ok).toBe(true);
    const o = await db.order.findUniqueOrThrow({ where: { id }, include: { events: true } });
    expect(o).toMatchObject({
      fulfilmentStatus: "delivered",
      carrier: "Nile Post",
      trackingNumber: "NP123",
    });
    expect(o.packedAt && o.shippedAt && o.deliveredAt).toBeTruthy();
    expect(o.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["created", "paid", "packed", "shipped", "delivered"]),
    );
    const mail = readdirSync(OUTBOX).filter((n) => n.includes("-shipped-"));
    expect(mail).toHaveLength(1);
  });

  it("does not fulfil unpaid orders", async () => {
    const r = await addItem(db, null, f.plenty.id, 1);
    if (!r.ok) throw new Error("cart");
    const o = await createPendingOrder(db, { cartId: r.data.cartId, customer, provider: "mock" });
    if (!o.ok) throw new Error("order");
    expect(await advanceFulfilment(db, admin, o.order.id, "packed")).toMatchObject({ ok: false });
    // ...but an admin can cancel it, which releases the stock.
    expect((await cancelOrder(db, admin, o.order.id, new MockProvider())).ok).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.order.id } })).status).toBe(
      "cancelled",
    );
    expect((await db.product.findUniqueOrThrow({ where: { id: f.plenty.id } })).stock).toBe(10);
  });

  it("refunds without restock, once, and records it everywhere", async () => {
    const id = await paidOrder([[f.plenty.id, 2]]);
    const notified = vi.fn(async () => undefined);
    const res = await refundOrder(db, admin, id, { restock: false }, new MockProvider(), notified);
    expect(res.ok).toBe(true);
    expect(notified).toHaveBeenCalledWith(id);
    const o = await db.order.findUniqueOrThrow({
      where: { id },
      include: { refund: true, events: true },
    });
    expect(o.status).toBe("refunded");
    expect(o.refund).toMatchObject({
      amountCents: o.totalCents,
      restocked: false,
      provider: "mock",
    });
    expect(o.events.some((e) => e.type === "refunded")).toBe(true);
    expect((await db.product.findUniqueOrThrow({ where: { id: f.plenty.id } })).stock).toBe(8);
    const again = await refundOrder(db, admin, id, { restock: true }, new MockProvider());
    expect(again).toMatchObject({ ok: false });
    expect(await db.refund.count()).toBe(1);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "order.refund" } });
    expect(audit.summary).not.toContain("omar@example.com");
  });

  it("a provider failure changes nothing; a provider mismatch is refused", async () => {
    const id = await paidOrder([[f.plenty.id, 1]]);
    const failing: PaymentProvider = {
      name: "mock",
      createCheckoutSession: vi.fn(),
      cancelSession: vi.fn(),
      refundPayment: vi.fn(async () => {
        throw new Error("network down");
      }),
    };
    expect(await refundOrder(db, admin, id, { restock: true }, failing)).toMatchObject({
      ok: false,
    });
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe("paid");
    const stripeLike = { ...failing, name: "stripe" as const };
    expect(await refundOrder(db, admin, id, { restock: false }, stripeLike)).toMatchObject({
      ok: false,
    });
    expect(stripeLike.refundPayment).toHaveBeenCalledTimes(1); // only the first, failing call
  });

  it("notes are stored as text and audited without their content", async () => {
    const id = await paidOrder([[f.plenty.id, 1]]);
    expect((await addNote(db, staff, id, "  <script>alert(1)</script> call Omar  ")).ok).toBe(true);
    const n = await db.orderNote.findFirstOrThrow({ where: { orderId: id } });
    expect(n.body).toBe("<script>alert(1)</script> call Omar");
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "order.note_add" } });
    expect(audit.summary).not.toContain("Omar");
  });

  it("CSV export escapes formula cells and is audited", async () => {
    const id = await paidOrder([[f.plenty.id, 1]]);
    await db.order.update({ where: { id }, data: { customerName: '=HYPERLINK("http://evil")' } });
    const { csv, count } = await exportOrdersCsv(db, admin, { status: "paid" });
    expect(count).toBe(1);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain("United Arab Emirates");
    expect(await db.auditLog.count({ where: { action: "order.export_csv" } })).toBe(1);
  });

  it("the dashboard counts paid orders and drops refunded ones", async () => {
    const a = await paidOrder([[f.plenty.id, 1]]);
    await paidOrder([[f.plenty.id, 2]]);
    const d1 = await getDashboard(db);
    expect(d1.kpis.today).toEqual({ revenue: 1250 + 595 + 2500 + 595, orders: 2 });
    await refundOrder(db, admin, a, { restock: false }, new MockProvider());
    const d2 = await getDashboard(db);
    expect(d2.kpis.today.orders).toBe(1);
    expect(d2.days.at(-1)?.revenueCents).toBe(2500 + 595);
  });
});

// ---------------------------------------------------------------------------
describe("users and the last admin", () => {
  it("nobody can demote or disable themselves", async () => {
    expect(await changeRole(db, admin, admin.id, "staff")).toMatchObject({ ok: false });
    expect(await setUserActive(db, admin, admin.id, false)).toMatchObject({ ok: false });
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe("admin");
  });

  it("never leaves the store without an active admin (even for a stale session)", async () => {
    const second = await inviteUser(db, admin, {
      email: "second@example.com",
      name: "Second",
      role: "admin",
    });
    if (!second.ok) throw new Error("invite failed");
    expect(second.value.password).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const b: Actor = { id: second.value.id, role: "admin" };
    // Two admins: B may disable A.
    expect((await setUserActive(db, b, admin.id, false)).ok).toBe(true);
    // A's old (stale) context tries to demote or disable B, the last active admin: refused.
    expect(await changeRole(db, admin, b.id, "staff")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/at least one active admin/i),
    });
    expect(await setUserActive(db, admin, b.id, false)).toMatchObject({ ok: false });
    expect(await db.adminUser.count({ where: { role: "admin", isActive: true } })).toBe(1);
    // Staff can be promoted and demoted freely.
    expect((await changeRole(db, b, staff.id, "admin")).ok).toBe(true);
    expect((await changeRole(db, b, staff.id, "staff")).ok).toBe(true);
    expect(await db.auditLog.count({ where: { action: "user.role_change" } })).toBe(2);
  });

  it("invites are unique by email", async () => {
    const dup = await inviteUser(db, admin, {
      email: "STAFF@example.com",
      name: "Dup",
      role: "staff",
    });
    expect(dup).toMatchObject({ ok: false });
  });
});
