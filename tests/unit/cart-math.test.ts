import { describe, expect, it } from "vitest";
import {
  cartItemCount,
  cartSubtotalCents,
  cartTotals,
  clampQuantity,
  FLAT_SHIPPING_CENTS,
  lineTotalCents,
  MAX_QUANTITY_PER_LINE,
  shippingCents,
} from "@/lib/cart/math";

describe("clampQuantity", () => {
  it("keeps values inside [1, stock]", () => {
    expect(clampQuantity(3, 10)).toBe(3);
    expect(clampQuantity(0, 10)).toBe(1);
    expect(clampQuantity(-5, 10)).toBe(1);
    expect(clampQuantity(11, 10)).toBe(10);
  });

  it("returns 0 when nothing can be bought", () => {
    expect(clampQuantity(1, 0)).toBe(0);
    expect(clampQuantity(5, -2)).toBe(0);
  });

  it("truncates fractions and handles non-finite input", () => {
    expect(clampQuantity(2.9, 10)).toBe(2);
    expect(clampQuantity(Number.NaN, 10)).toBe(1);
    expect(clampQuantity(Number.POSITIVE_INFINITY, 10)).toBe(1);
  });

  it("never exceeds the per-line cap", () => {
    expect(clampQuantity(500, 1000)).toBe(MAX_QUANTITY_PER_LINE);
  });
});

describe("cart totals", () => {
  const lines = [
    { priceCents: 4800, quantity: 2 },
    { priceCents: 1999, quantity: 3 },
  ];

  it("computes line totals and subtotal in integer cents", () => {
    expect(lineTotalCents(lines[0])).toBe(9600);
    expect(cartSubtotalCents(lines)).toBe(9600 + 5997);
    expect(cartItemCount(lines)).toBe(5);
  });

  it("does not suffer from float rounding", () => {
    // 0.1 + 0.2 style problems cannot happen with cents.
    const many = Array.from({ length: 10 }, () => ({ priceCents: 10, quantity: 1 }));
    expect(cartSubtotalCents(many)).toBe(100);
  });

  it("applies free shipping from $50 and a flat rate below", () => {
    expect(shippingCents(0)).toBe(0);
    expect(shippingCents(4999)).toBe(FLAT_SHIPPING_CENTS);
    expect(shippingCents(5000)).toBe(0);
  });

  it("summarises the cart", () => {
    expect(cartTotals([{ priceCents: 1900, quantity: 1 }])).toEqual({
      subtotalCents: 1900,
      shippingCents: 595,
      totalCents: 2495,
      itemCount: 1,
      amountToFreeShippingCents: 3100,
    });
    expect(cartTotals([])).toEqual({
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
      itemCount: 0,
      amountToFreeShippingCents: 5000,
    });
  });
});
