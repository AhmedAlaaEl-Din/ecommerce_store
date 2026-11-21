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
      const quantity = i.quantity;
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
        lineTotalCents: lineTotalCents({ priceCents: i.product.priceCents, quantity }),
      };
    });

  return { id: cart.id, lines, ...cartTotals(lines) };
}

export async function getCartItemCount(db: Db, cartId: string | null): Promise<number> {
  if (!cartId) return 0;
  const agg = await db.cartItem.aggregate({
    where: { cartId, product: { isActive: true } },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

async function findBuyableProduct(db: Db, productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, stock: true, isActive: true, name: true },
  });
  if (!product || !product.isActive) return null;
  return product;
}

async function ensureCart(db: Db, cartId: string | null): Promise<string> {
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
  const product = await findBuyableProduct(db, productId);
  if (!product) return { ok: false, code: "PRODUCT_NOT_FOUND" };
  if (product.stock <= 0) return { ok: false, code: "OUT_OF_STOCK" };

  const id = await ensureCart(db, cartId);
  return db.$transaction(async (tx) => {
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
      ok: true as const,
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
  await db.cartItem.update({ where: { id: item.id }, data: { quantity: next } });
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
  await db.cartItem.delete({ where: { id: item.id } });
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
