import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addItem,
  getCart,
  getCartItemCount,
  pruneIdleCarts,
  removeItem,
  restoreItem,
  updateItemQuantity,
} from "@/lib/cart/service";
import { makeFixtures, resetDb, testDb } from "./helpers";

const db = testDb();
let f: Awaited<ReturnType<typeof makeFixtures>>;

beforeEach(async () => {
  await resetDb(db);
  f = await makeFixtures(db);
});

afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

async function newCartWith(productId: string, qty: number) {
  const r = await addItem(db, null, productId, qty);
  if (!r.ok) throw new Error(`setup failed: ${r.code}`);
  return r.data.cartId;
}

describe("addItem", () => {
  it("creates a cart with a random UUID id when none exists", async () => {
    const r = await addItem(db, null, f.plenty.id, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cartId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.data.quantity).toBe(2);
    expect(r.data.limited).toBe(false);
    expect(await db.cart.count()).toBe(1);
  });

  it("increases the quantity when the product is already in the cart", async () => {
    const cartId = await newCartWith(f.plenty.id, 2);
    const r = await addItem(db, cartId, f.plenty.id, 3);
    expect(r.ok && r.data.quantity).toBe(5);
    expect(await db.cartItem.count({ where: { cartId } })).toBe(1);
  });

  it("creates a new cart if the cookie points at a cart that no longer exists", async () => {
    const r = await addItem(db, "00000000-0000-4000-8000-000000000000", f.plenty.id, 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.cartId).not.toBe("00000000-0000-4000-8000-000000000000");
  });

  it("caps the quantity at the available stock and reports it", async () => {
    const r = await addItem(db, null, f.scarce.id, 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.quantity).toBe(2);
    expect(r.data.limited).toBe(true);
    const again = await addItem(db, r.data.cartId, f.scarce.id, 1);
    expect(again.ok && again.data.quantity).toBe(2);
    expect(again.ok && again.data.limited).toBe(true);
  });

  it("rejects an unknown product", async () => {
    const r = await addItem(db, null, "doesnotexist123", 1);
    expect(r).toEqual({ ok: false, code: "PRODUCT_NOT_FOUND" });
    expect(await db.cart.count()).toBe(0);
  });

  it("rejects an inactive product", async () => {
    const r = await addItem(db, null, f.inactive.id, 1);
    expect(r).toEqual({ ok: false, code: "PRODUCT_NOT_FOUND" });
  });

  it("rejects an out-of-stock product", async () => {
    const r = await addItem(db, null, f.soldOut.id, 1);
    expect(r).toEqual({ ok: false, code: "OUT_OF_STOCK" });
  });
});

describe("updateItemQuantity", () => {
  it("sets the quantity", async () => {
    const cartId = await newCartWith(f.plenty.id, 1);
    const r = await updateItemQuantity(db, cartId, f.plenty.id, 4);
    expect(r).toEqual({ ok: true, data: { quantity: 4, limited: false } });
  });

  it("clamps to stock and never below 1", async () => {
    const cartId = await newCartWith(f.scarce.id, 1);
    expect(await updateItemQuantity(db, cartId, f.scarce.id, 9)).toEqual({
      ok: true,
      data: { quantity: 2, limited: true },
    });
    expect(await updateItemQuantity(db, cartId, f.scarce.id, 0)).toEqual({
      ok: true,
      data: { quantity: 1, limited: false },
    });
  });

  it("fails for a product that is not in the cart", async () => {
    const cartId = await newCartWith(f.plenty.id, 1);
    expect(await updateItemQuantity(db, cartId, f.scarce.id, 1)).toEqual({
      ok: false,
      code: "NOT_IN_CART",
    });
  });

  it("fails without a cart", async () => {
    expect(await updateItemQuantity(db, null, f.plenty.id, 1)).toEqual({
      ok: false,
      code: "CART_NOT_FOUND",
    });
  });
});

describe("removeItem and restoreItem (undo)", () => {
  it("removes the line and returns what was removed", async () => {
    const cartId = await newCartWith(f.plenty.id, 3);
    const r = await removeItem(db, cartId, f.plenty.id);
    expect(r).toEqual({ ok: true, data: { productId: f.plenty.id, quantity: 3 } });
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0);
  });

  it("undo restores the line with its previous quantity", async () => {
    const cartId = await newCartWith(f.plenty.id, 3);
    await removeItem(db, cartId, f.plenty.id);
    const r = await restoreItem(db, cartId, f.plenty.id, 3);
    expect(r.ok && r.data.quantity).toBe(3);
    expect(r.ok && r.data.cartId).toBe(cartId);
    const cart = await getCart(db, cartId);
    expect(cart.lines.map((l) => [l.slug, l.quantity])).toEqual([["plenty", 3]]);
  });

  it("undo respects stock that dropped in the meantime", async () => {
    const cartId = await newCartWith(f.plenty.id, 6);
    await removeItem(db, cartId, f.plenty.id);
    await db.product.update({ where: { id: f.plenty.id }, data: { stock: 4 } });
    const r = await restoreItem(db, cartId, f.plenty.id, 6);
    expect(r.ok && r.data.quantity).toBe(4);
    expect(r.ok && r.data.limited).toBe(true);
  });

  it("removing something that is not in the cart fails cleanly", async () => {
    const cartId = await newCartWith(f.plenty.id, 1);
    expect(await removeItem(db, cartId, f.scarce.id)).toEqual({ ok: false, code: "NOT_IN_CART" });
  });
});

describe("getCart", () => {
  it("returns an empty cart for no id or an unknown id", async () => {
    expect((await getCart(db, null)).lines).toEqual([]);
    expect((await getCart(db, "00000000-0000-4000-8000-000000000000")).itemCount).toBe(0);
  });

  it("always reads prices from the database and computes totals in cents", async () => {
    const cartId = await newCartWith(f.plenty.id, 2); // 2 x 1250
    await addItem(db, cartId, f.scarce.id, 1); // 1 x 4000
    let cart = await getCart(db, cartId);
    expect(cart.subtotalCents).toBe(6500);
    expect(cart.shippingCents).toBe(0);
    expect(cart.itemCount).toBe(3);

    await db.product.update({ where: { id: f.plenty.id }, data: { priceCents: 1000 } });
    cart = await getCart(db, cartId);
    expect(cart.subtotalCents).toBe(6000);
    expect(cart.lines.find((l) => l.slug === "plenty")?.lineTotalCents).toBe(2000);
  });

  it("charges flat shipping below the free-shipping threshold", async () => {
    const cartId = await newCartWith(f.plenty.id, 1);
    const cart = await getCart(db, cartId);
    expect(cart.subtotalCents).toBe(1250);
    expect(cart.shippingCents).toBe(600);
    expect(cart.totalCents).toBe(1850);
  });

  it("hides products that became inactive", async () => {
    const cartId = await newCartWith(f.plenty.id, 2);
    await addItem(db, cartId, f.scarce.id, 1);
    await db.product.update({ where: { id: f.scarce.id }, data: { isActive: false } });
    const cart = await getCart(db, cartId);
    expect(cart.lines.map((l) => l.slug)).toEqual(["plenty"]);
    expect(await getCartItemCount(db, cartId)).toBe(2);
  });
});

describe("stock changes after adding", () => {
  it("re-clamps quantities to current stock and excludes sold-out lines from totals", async () => {
    const cartId = await newCartWith(f.plenty.id, 5); // 5 x 1250
    await addItem(db, cartId, f.scarce.id, 2); // 2 x 4000
    await db.product.update({ where: { id: f.plenty.id }, data: { stock: 3 } });
    await db.product.update({ where: { id: f.scarce.id }, data: { stock: 0 } });
    const cart = await getCart(db, cartId);
    const plenty = cart.lines.find((l) => l.slug === "plenty")!;
    const scarce = cart.lines.find((l) => l.slug === "scarce")!;
    expect(plenty.quantity).toBe(3);
    expect(plenty.unavailable).toBe(false);
    expect(scarce.unavailable).toBe(true);
    expect(scarce.lineTotalCents).toBe(0);
    expect(cart.subtotalCents).toBe(3750);
    expect(cart.itemCount).toBe(3);
    expect(await getCartItemCount(db, cartId)).toBe(3);
  });
});

describe("pruneIdleCarts", () => {
  it("deletes only carts idle for longer than the limit, and every change refreshes updatedAt", async () => {
    const oldCart = await newCartWith(f.plenty.id, 1);
    const activeCart = await newCartWith(f.plenty.id, 1);
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await db.cart.updateMany({ data: { updatedAt: longAgo } });
    // A quantity change on the active cart marks it as recently used.
    await updateItemQuantity(db, activeCart, f.plenty.id, 2);
    expect(await pruneIdleCarts(db, 30)).toBe(1);
    expect(await db.cart.findUnique({ where: { id: oldCart } })).toBeNull();
    expect(await db.cart.findUnique({ where: { id: activeCart } })).not.toBeNull();
    expect(await db.cartItem.count({ where: { cartId: oldCart } })).toBe(0);
  });
});
