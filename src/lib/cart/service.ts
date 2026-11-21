/**
 * Cart service. Pure data-layer logic that takes a Prisma client, so it can be
 * exercised against a separate SQLite database in integration tests.
 *
 * Trust boundary: callers only ever pass a product id and a quantity. Prices,
 * stock and active status are always read from the database here.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { cartTotals, clampQuantity, lineTotalCents } from "./math";

export type CartErrorCode = "PRODUCT_NOT_FOUND" | "OUT_OF_STOCK" | "NOT_IN_CART" | "CART_NOT_FOUND";

export type CartResult<T> = { ok: true; data: T } | { ok: false; code: CartErrorCode };

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  imagePath: string;
  categoryName: string;
  accentColor: string;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  stock: number;
  quantity: number;
  lineTotalCents: number;
  /** True when the product sold out after it was added; excluded from totals. */
  unavailable: boolean;
};

export type CartView = {
  id: string | null;
  lines: CartLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
  amountToFreeShippingCents: number;
};

export const EMPTY_CART: CartView = {
  id: null,
  lines: [],
  ...cartTotals([]),
};

/** Loads a cart with current prices from the database. Inactive products are hidden. */
export async function getCart(db: Db, cartId: string | null): Promise<CartView> {
  if (!cartId) return EMPTY_CART;
  const cart = await db.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          product: { include: { category: { select: { name: true, accentColor: true } } } },
        },
      },
    },
  });
  if (!cart) return EMPTY_CART;

  const lines: CartLine[] = cart.items
    .filter((i) => i.product.isActive)
    .map((i) => {
      // Never show more than can be bought now (stock may have dropped since adding).
      const unavailable = i.product.stock <= 0;
      const quantity = unavailable ? i.quantity : Math.min(i.quantity, i.product.stock);
      return {
        productId: i.productId,
        slug: i.product.slug,
        name: i.product.name,
        imagePath: i.product.imagePath,
        categoryName: i.product.category.name,
        accentColor: i.product.category.accentColor,
        priceCents: i.product.priceCents,
        compareAtCents: i.product.compareAtCents,
        currency: i.product.currency,
        stock: i.product.stock,
        quantity,
        lineTotalCents: unavailable
          ? 0
          : lineTotalCents({ priceCents: i.product.priceCents, quantity }),
        unavailable,
      };
    });

  return { id: cart.id, lines, ...cartTotals(lines.filter((l) => !l.unavailable)) };
}

export async function getCartItemCount(db: Db, cartId: string | null): Promise<number> {
  if (!cartId) return 0;
  const items = await db.cartItem.findMany({
    where: { cartId, product: { isActive: true, stock: { gt: 0 } } },
    select: { quantity: true, product: { select: { stock: true } } },
  });
  return items.reduce((sum, i) => sum + Math.min(i.quantity, i.product.stock), 0);
}

/**
 * Units of one product in the cart, clamped to current stock (as the cart page shows them).
 * Returns 0 for no cart, an unknown cart, or an inactive / sold-out product.
 */
export async function getCartQuantity(
  db: Db,
  cartId: string | null,
  productId: string,
): Promise<number> {
  if (!cartId) return 0;
  const item = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
    select: { quantity: true, product: { select: { stock: true, isActive: true } } },
  });
  if (!item || !item.product.isActive) return 0;
  return Math.max(Math.min(item.quantity, item.product.stock), 0);
}

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

async function findBuyableProduct(db: Db | Tx, productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, stock: true, isActive: true },
  });
  if (!product || !product.isActive) return null;
  return product;
}

async function ensureCart(db: Db | Tx, cartId: string | null): Promise<string> {
  if (cartId) {
    const existing = await db.cart.findUnique({ where: { id: cartId }, select: { id: true } });
    if (existing) return existing.id;
  }
  const created = await db.cart.create({ data: { id: randomUUID() }, select: { id: true } });
  return created.id;
}

export type AddResult = {
  cartId: string;
  quantity: number;
  /** True when the requested quantity was reduced to fit the available stock. */
  limited: boolean;
  stock: number;
};

/**
 * Adds a product to the cart (creating the cart if needed). Adding a product
 * that is already in the cart increases its quantity, capped at stock.
 */
export async function addItem(
  db: Db,
  cartId: string | null,
  productId: string,
  quantity: number,
): Promise<CartResult<AddResult>> {
  // Stock check, cart creation and the quantity write happen in one transaction
  // (SQLite serialises write transactions), so concurrent adds cannot overshoot stock.
  return db.$transaction(async (tx): Promise<CartResult<AddResult>> => {
    const product = await findBuyableProduct(tx, productId);
    if (!product) return { ok: false, code: "PRODUCT_NOT_FOUND" };
    if (product.stock <= 0) return { ok: false, code: "OUT_OF_STOCK" };
    const id = await ensureCart(tx, cartId);
    const existing = await tx.cartItem.findUnique({
      where: { cartId_productId: { cartId: id, productId } },
      select: { quantity: true },
    });
    const requested = (existing?.quantity ?? 0) + quantity;
    const next = clampQuantity(requested, product.stock);
    await tx.cartItem.upsert({
      where: { cartId_productId: { cartId: id, productId } },
      create: { cartId: id, productId, quantity: next },
      update: { quantity: next },
    });
    await tx.cart.update({ where: { id }, data: { updatedAt: new Date() } });
    return {
      ok: true,
      data: { cartId: id, quantity: next, limited: next < requested, stock: product.stock },
    };
  });
}

/** Sets a line's quantity, clamped to [1, stock]. */
export async function updateItemQuantity(
  db: Db,
  cartId: string | null,
  productId: string,
  quantity: number,
): Promise<CartResult<{ quantity: number; limited: boolean }>> {
  if (!cartId) return { ok: false, code: "CART_NOT_FOUND" };
  const item = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
    include: { product: { select: { stock: true, isActive: true } } },
  });
  if (!item) return { ok: false, code: "NOT_IN_CART" };
  if (!item.product.isActive) return { ok: false, code: "PRODUCT_NOT_FOUND" };
  if (item.product.stock <= 0) return { ok: false, code: "OUT_OF_STOCK" };

  const next = clampQuantity(quantity, item.product.stock);
  await db.$transaction([
    db.cartItem.update({ where: { id: item.id }, data: { quantity: next } }),
    db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } }),
  ]);
  return { ok: true, data: { quantity: next, limited: next < quantity } };
}

/** Removes a line and returns what was removed, so the UI can offer undo. */
export async function removeItem(
  db: Db,
  cartId: string | null,
  productId: string,
): Promise<CartResult<{ productId: string; quantity: number }>> {
  if (!cartId) return { ok: false, code: "CART_NOT_FOUND" };
  const item = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
    select: { id: true, quantity: true },
  });
  if (!item) return { ok: false, code: "NOT_IN_CART" };
  await db.$transaction([
    db.cartItem.delete({ where: { id: item.id } }),
    db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } }),
  ]);
  return { ok: true, data: { productId, quantity: item.quantity } };
}

/**
 * Undo for remove: puts the line back with its previous quantity (clamped to
 * current stock). If the product was re-added meanwhile, quantities are merged.
 */
export async function restoreItem(
  db: Db,
  cartId: string | null,
  productId: string,
  quantity: number,
): Promise<CartResult<AddResult>> {
  return addItem(db, cartId, productId, quantity);
}

/**
 * Deletes carts that have not changed for `maxIdleDays` (default 30, matching
 * the cookie lifetime). Run with `npm run db:prune-carts`.
 */
export async function pruneIdleCarts(db: Db, maxIdleDays = 30, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - maxIdleDays * 24 * 60 * 60 * 1000);
  const result = await db.cart.deleteMany({ where: { updatedAt: { lt: cutoff } } });
  return result.count;
}
