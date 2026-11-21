"use server";

/**
 * Cart server actions. Every input is validated with zod on the server, and only
 * a product id and a quantity are accepted from the client: prices, stock and
 * availability always come from the database (see lib/cart/service.ts).
 */
import { readCartId, writeCartId } from "@/lib/cart/cookie";
import {
  addItem,
  getCart,
  getCartItemCount,
  removeItem,
  restoreItem,
  updateItemQuantity,
  type CartErrorCode,
  type CartView,
} from "@/lib/cart/service";
import { db } from "@/lib/db";
import {
  addToCartSchema,
  removeCartItemSchema,
  restoreCartItemSchema,
  updateCartItemSchema,
} from "@/lib/schemas";

export type AddToCartResult =
  | { ok: true; itemCount: number; quantity: number; limited: boolean; stock: number }
  | { ok: false; message: string };

export type CartMutationResult =
  | { ok: true; cart: CartView; limited?: boolean; removed?: { productId: string; quantity: number } }
  | { ok: false; message: string; cart?: CartView };

const MESSAGES: Record<CartErrorCode | "INVALID" | "UNEXPECTED", string> = {
  PRODUCT_NOT_FOUND: "Sorry, that product isn’t available any more.",
  OUT_OF_STOCK: "Sorry, that product is out of stock right now.",
  NOT_IN_CART: "That item is no longer in your cart.",
  CART_NOT_FOUND: "We couldn’t find your cart. Please add the item again.",
  INVALID: "Something about that request didn’t look right. Please try again.",
  UNEXPECTED: "Something went wrong on our side. Please try again.",
};

function logError(action: string, err: unknown) {
  // Server-side only; the client receives a friendly message, never the raw error.
  console.error(`[cart] ${action} failed:`, err instanceof Error ? err.message : err);
}

export async function addToCartAction(input: unknown): Promise<AddToCartResult> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.INVALID };
  try {
    const cartId = await readCartId();
    const result = await addItem(db, cartId, parsed.data.productId, parsed.data.quantity);
    if (!result.ok) return { ok: false, message: MESSAGES[result.code] };
    await writeCartId(result.data.cartId);
    const itemCount = await getCartItemCount(db, result.data.cartId);
    return {
      ok: true,
      itemCount,
      quantity: result.data.quantity,
      limited: result.data.limited,
      stock: result.data.stock,
    };
  } catch (err) {
    logError("add", err);
    return { ok: false, message: MESSAGES.UNEXPECTED };
  }
}

export async function updateCartItemAction(input: unknown): Promise<CartMutationResult> {
  const parsed = updateCartItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.INVALID };
  try {
    const cartId = await readCartId();
    const result = await updateItemQuantity(db, cartId, parsed.data.productId, parsed.data.quantity);
    const cart = await getCart(db, cartId);
    if (!result.ok) return { ok: false, message: MESSAGES[result.code], cart };
    return { ok: true, cart, limited: result.data.limited };
  } catch (err) {
    logError("update", err);
    return { ok: false, message: MESSAGES.UNEXPECTED };
  }
}

export async function removeCartItemAction(input: unknown): Promise<CartMutationResult> {
  const parsed = removeCartItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.INVALID };
  try {
    const cartId = await readCartId();
    const result = await removeItem(db, cartId, parsed.data.productId);
    const cart = await getCart(db, cartId);
    if (!result.ok) return { ok: false, message: MESSAGES[result.code], cart };
    return { ok: true, cart, removed: result.data };
  } catch (err) {
    logError("remove", err);
    return { ok: false, message: MESSAGES.UNEXPECTED };
  }
}

export async function restoreCartItemAction(input: unknown): Promise<CartMutationResult> {
  const parsed = restoreCartItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.INVALID };
  try {
    const cartId = await readCartId();
    if (!cartId) return { ok: false, message: MESSAGES.CART_NOT_FOUND };
    const result = await restoreItem(db, cartId, parsed.data.productId, parsed.data.quantity);
    if (!result.ok) {
      return { ok: false, message: MESSAGES[result.code], cart: await getCart(db, cartId) };
    }
    await writeCartId(result.data.cartId);
    const cart = await getCart(db, result.data.cartId);
    return { ok: true, cart, limited: result.data.limited };
  } catch (err) {
    logError("restore", err);
    return { ok: false, message: MESSAGES.UNEXPECTED };
  }
}
