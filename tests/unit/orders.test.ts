import { describe, expect, it, vi } from "vitest";
import { cartTotals, FLAT_SHIPPING_CENTS, shippingCents } from "@/lib/cart/math";
import type { Db } from "@/lib/db";
import {
  COUNTRIES,
  EMPTY_CHECKOUT_VALUES,
  readCheckoutForm,
  validateCheckout,
} from "@/lib/orders/checkout-schema";
import {
  formatOrderNumber,
  newPublicToken,
  ORDER_NUMBER_RE,
  PUBLIC_TOKEN_RE,
} from "@/lib/orders/service";
import { applyPaymentEvent } from "@/lib/payments/webhook";

describe("order totals and shipping", () => {
  it("ships free from $50, otherwise a flat $5.95", () => {
    expect(FLAT_SHIPPING_CENTS).toBe(595);
    expect(shippingCents(4999)).toBe(595);
    expect(shippingCents(5000)).toBe(0);
    expect(shippingCents(12000)).toBe(0);
    expect(cartTotals([{ priceCents: 1900, quantity: 2 }])).toMatchObject({
      subtotalCents: 3800,
      shippingCents: 595,
      totalCents: 4395,
    });
  });
});

describe("order numbers and tokens", () => {
  it("formats NG-YYYY-000123", () => {
    expect(formatOrderNumber(2026, 123)).toBe("NG-2026-000123");
    expect(formatOrderNumber(2026, 1)).toBe("NG-2026-000001");
    expect(formatOrderNumber(2027, 1234567)).toBe("NG-2027-1234567");
    expect(ORDER_NUMBER_RE.test("NG-2026-000123")).toBe(true);
    expect(ORDER_NUMBER_RE.test("NG-2026-12")).toBe(false);
  });

  it("rejects invalid parts", () => {
    expect(() => formatOrderNumber(2026, 0)).toThrow();
    expect(() => formatOrderNumber(2026, 1.5)).toThrow();
  });

  it("public tokens are long, URL-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newPublicToken()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(PUBLIC_TOKEN_RE);
  });
});

describe("checkout form validation", () => {
  const good = {
    email: "  Mona@Example.com ",
    name: "Mona   Example",
    addressLine1: "12 Reed Lane",
    addressLine2: "",
    city: "Delta Town",
    postalCode: "dt 1024",
    country: "nilera",
  };

  it("normalises valid input", () => {
    const r = validateCheckout(good);
    expect(r).toEqual({
      ok: true,
      data: {
        email: "mona@example.com",
        name: "Mona Example",
        addressLine1: "12 Reed Lane",
        addressLine2: "",
        city: "Delta Town",
        postalCode: "DT 1024",
        country: "nilera",
      },
    });
  });

  it("reports one friendly message per field", () => {
    const r = validateCheckout({ ...EMPTY_CHECKOUT_VALUES });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(
      ["addressLine1", "city", "country", "email", "name", "postalCode"].sort(),
    );
    expect(r.errors.email).toBe("Please enter your email address.");
  });

  it("rejects bad emails, postal codes and unknown countries", () => {
    const r = validateCheckout({
      ...good,
      email: "mona@",
      postalCode: "<script>",
      country: "atlantis",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.email).toMatch(/valid email/);
    expect(r.errors.postalCode).toMatch(/letters, numbers/);
    expect(r.errors.country).toBe("Please choose a country.");
  });

  it("limits lengths", () => {
    const r = validateCheckout({ ...good, name: "x".repeat(101), addressLine2: "y".repeat(121) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["addressLine2", "name"]);
  });

  it("reads only known fields from FormData, as strings", () => {
    const fd = new FormData();
    fd.set("email", "a@example.com");
    fd.set("totalCents", "1");
    fd.set("country", new Blob(["x"]));
    const v = readCheckoutForm(fd);
    expect(v).toEqual({ ...EMPTY_CHECKOUT_VALUES, email: "a@example.com" });
    expect("totalCents" in v).toBe(false);
  });

  it("uses an invented country list", () => {
    expect(COUNTRIES.map((c) => c.name)).toEqual([
      "Nilera",
      "Deltamar",
      "Sahelia",
      "Oasis Isles",
      "Riverland",
    ]);
  });
});

describe("webhook idempotency guard (unit, fake database)", () => {
  const event = {
    id: "evt_1",
    type: "checkout.session.completed",
    sessionId: "cs_1",
    orderId: "o1",
    paymentStatus: "paid",
    amountTotal: null,
    currency: null,
    livemode: false,
  };

  it("acknowledges an already-processed event without touching the order", async () => {
    const orderFind = vi.fn();
    const tx = {
      processedEvent: { findUnique: vi.fn(async () => ({ id: "evt_1" })), create: vi.fn() },
      order: { findUnique: orderFind },
    };
    const db = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } as unknown as Db;
    expect(await applyPaymentEvent(db, event)).toEqual({ status: "duplicate" });
    expect(tx.processedEvent.create).not.toHaveBeenCalled();
    expect(orderFind).not.toHaveBeenCalled();
  });

  it("treats a unique-key race on the event id as a duplicate", async () => {
    const db = {
      $transaction: async () => {
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      },
    } as unknown as Db;
    expect(await applyPaymentEvent(db, event)).toEqual({ status: "duplicate" });
  });

  it("rethrows other errors so the provider retries", async () => {
    const db = {
      $transaction: async () => {
        throw new Error("disk I/O error");
      },
    } as unknown as Db;
    await expect(applyPaymentEvent(db, event)).rejects.toThrow("disk I/O error");
  });
});
