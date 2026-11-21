/** Hard cap per cart line, independent of stock. */
export const MAX_QUANTITY_PER_LINE = 99;

export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
export const FLAT_SHIPPING_CENTS = 595;

/**
 * Clamps a requested quantity to [1, min(stock, MAX_QUANTITY_PER_LINE)].
 * Returns 0 when the product cannot be bought at all (stock <= 0).
 * Non-finite input is treated as 1.
 */
export function clampQuantity(requested: number, stock: number): number {
  const max = Math.min(Math.max(Math.trunc(stock), 0), MAX_QUANTITY_PER_LINE);
  if (max === 0) return 0;
  const q = Number.isFinite(requested) ? Math.trunc(requested) : 1;
  return Math.min(Math.max(q, 1), max);
}

/** Most units of a product a cart can hold right now: min(stock, MAX_QUANTITY_PER_LINE), never negative. */
export function maxPerLine(stock: number): number {
  return Number.isFinite(stock)
    ? Math.min(Math.max(Math.trunc(stock), 0), MAX_QUANTITY_PER_LINE)
    : 0;
}

/** How many more units can still be added when the cart already holds `inCart`. */
export function remainingAddable(stock: number, inCart: number): number {
  const held = Number.isFinite(inCart) ? Math.max(Math.trunc(inCart), 0) : 0;
  return Math.max(maxPerLine(stock) - held, 0);
}

export type PricedLine = { priceCents: number; quantity: number };

export function lineTotalCents(line: PricedLine): number {
  return line.priceCents * line.quantity;
}

export function cartSubtotalCents(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotalCents(l), 0);
}

export function cartItemCount(lines: Array<{ quantity: number }>): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Demo shipping rule: free over $50, otherwise a flat rate. Empty carts ship for $0. */
export function shippingCents(subtotalCents: number): number {
  if (subtotalCents <= 0) return 0;
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
}

export function cartTotals(lines: PricedLine[]) {
  const subtotal = cartSubtotalCents(lines);
  const shipping = shippingCents(subtotal);
  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    totalCents: subtotal + shipping,
    itemCount: cartItemCount(lines),
    amountToFreeShippingCents: Math.max(FREE_SHIPPING_THRESHOLD_CENTS - subtotal, 0),
  };
}
