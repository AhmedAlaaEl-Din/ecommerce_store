/**
 * Phase 3 unit tests: role rules, slugs, CSV escaping, the fulfilment state
 * machine, refund rules, password policy, session expiry and lockout, upload
 * type detection, price parsing, Stripe refunds (SDK mocked), dashboard buckets.
 */
import { describe, expect, it, vi } from "vitest";
import { summaryText } from "@/lib/admin/audit-list";
import { changedFields } from "@/lib/admin/audit";
import { escapeCsvCell, toCsv } from "@/lib/admin/csv";
import { revenueByDay } from "@/lib/admin/dashboard";
import { checkUpload, detectImageType, MAX_UPLOAD_BYTES, MEDIA_FILE_RE } from "@/lib/admin/images";
import {
  canCancel,
  checkFulfilmentTransition,
  checkRefund,
  maskReference,
  nextFulfilment,
} from "@/lib/admin/order-rules";
import {
  checkPasswordPolicy,
  generatePassword,
  hashPassword,
  verifyPassword,
} from "@/lib/admin/password";
import { parsePriceToCents, productFormSchema } from "@/lib/admin/products";
import { can, minimumRole, PERMISSIONS, type Permission } from "@/lib/admin/roles";
import {
  absoluteExpiry,
  afterFailedLogin,
  hashSessionToken,
  isLocked,
  isSessionTokenShape,
  LOCKOUT_MS,
  newSessionToken,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  sessionState,
  shouldTouch,
} from "@/lib/admin/session-rules";
import { slugify, uniqueSlug } from "@/lib/admin/slug";
import { assertCan, AdminPermissionError } from "@/lib/admin/actor";
import { reasonAllowsDelta } from "@/lib/inventory/stock";
import { RefundError, StripeProvider, type StripeCheckoutClient } from "@/lib/payments/stripe";
import { MockProvider } from "@/lib/payments/mock";

describe("role rules", () => {
  it("admins can do everything", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) expect(can("admin", p)).toBe(true);
  });

  it("staff get dashboard, orders (view, fulfil, notes) and products (view, adjust stock) only", () => {
    const allowed = (Object.keys(PERMISSIONS) as Permission[])
      .filter((p) => can("staff", p))
      .sort();
    expect(allowed).toEqual(
      [
        "dashboard.view",
        "inventory.view",
        "orders.fulfil",
        "orders.note",
        "orders.packingSlip",
        "orders.view",
        "products.adjustStock",
        "products.view",
      ].sort(),
    );
  });

  it.each([
    "products.archive",
    "products.delete",
    "products.edit",
    "orders.refund",
    "orders.cancel",
    "orders.export",
    "users.manage",
    "categories.manage",
    "audit.view",
    "customers.view",
    "inventory.settings",
  ] as Permission[])("staff are denied %s", (p) => {
    expect(can("staff", p)).toBe(false);
    expect(minimumRole(p)).toBe("admin");
    expect(() => assertCan({ id: "s", role: "staff" }, p)).toThrow(AdminPermissionError);
  });
});

describe("slugs", () => {
  it.each([
    ["Tide Wool Throw", "tide-wool-throw"],
    ["  Café Crème — Large!  ", "cafe-creme-large"],
    ["Salt & Pepper", "salt-and-pepper"],
    ["---", ""],
    ["Ünïcödé 2026", "unicode-2026"],
  ])("slugify(%j) = %j", (input, out) => expect(slugify(input)).toBe(out));

  it("caps length at 80 without a trailing hyphen", () => {
    const s = slugify("a ".repeat(100));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });

  it("finds the next free slug", () => {
    expect(uniqueSlug("mug", new Set())).toBe("mug");
    expect(uniqueSlug("mug", new Set(["mug", "mug-2"]))).toBe("mug-3");
    expect(uniqueSlug("", new Set())).toBe("item");
  });
});

describe("CSV escaping (formula injection guard)", () => {
  it.each([
    ['=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ["line\nbreak", '"line\nbreak"'],
    ["", ""],
  ])("escapes %j", (input, out) => expect(escapeCsvCell(input)).toBe(out));

  it("handles null/numbers and builds a CRLF file with a BOM", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(12.5)).toBe("12.5");
    expect(escapeCsvCell(-5)).toBe("'-5");
    const csv = toCsv(["a", "b"], [["=1", "x"]]);
    expect(csv).toBe("﻿a,b\r\n'=1,x\r\n");
  });
});

describe("fulfilment state machine", () => {
  const paid = (f: "unfulfilled" | "packed" | "shipped" | "delivered") => ({
    status: "paid" as const,
    fulfilmentStatus: f,
  });

  it("moves one step at a time", () => {
    expect(nextFulfilment("unfulfilled")).toBe("packed");
    expect(nextFulfilment("packed")).toBe("shipped");
    expect(nextFulfilment("shipped")).toBe("delivered");
    expect(nextFulfilment("delivered")).toBeNull();
    expect(checkFulfilmentTransition(paid("unfulfilled"), "packed")).toEqual({ ok: true });
    expect(checkFulfilmentTransition(paid("unfulfilled"), "shipped")).toEqual({
      ok: false,
      reason: "INVALID_STEP",
    });
    expect(checkFulfilmentTransition(paid("shipped"), "packed")).toEqual({
      ok: false,
      reason: "INVALID_STEP",
    });
    expect(checkFulfilmentTransition(paid("delivered"), "delivered")).toEqual({
      ok: false,
      reason: "INVALID_STEP",
    });
  });

  it("needs carrier and tracking number to ship", () => {
    expect(checkFulfilmentTransition(paid("packed"), "shipped")).toEqual({
      ok: false,
      reason: "TRACKING_REQUIRED",
    });
    expect(
      checkFulfilmentTransition(paid("packed"), "shipped", { carrier: " ", trackingNumber: "X1" }),
    ).toEqual({
      ok: false,
      reason: "TRACKING_REQUIRED",
    });
    expect(
      checkFulfilmentTransition(paid("packed"), "shipped", {
        carrier: "Nile Post",
        trackingNumber: "X1",
      }),
    ).toEqual({
      ok: true,
    });
  });

  it("only paid orders are fulfilled", () => {
    for (const status of [
      "pending_payment",
      "cancelled",
      "refunded",
      "payment_failed",
      "expired",
    ] as const) {
      expect(
        checkFulfilmentTransition({ status, fulfilmentStatus: "unfulfilled" }, "packed"),
      ).toEqual({
        ok: false,
        reason: "NOT_PAID",
      });
    }
  });
});

describe("refund and cancel rules", () => {
  it("refunds paid orders once, and only with a payment reference", () => {
    expect(checkRefund({ status: "paid", providerSessionId: "cs_1", hasRefund: false })).toEqual({
      ok: true,
    });
    expect(checkRefund({ status: "paid", providerSessionId: "cs_1", hasRefund: true })).toEqual({
      ok: false,
      reason: "ALREADY_REFUNDED",
    });
    expect(
      checkRefund({ status: "refunded", providerSessionId: "cs_1", hasRefund: false }),
    ).toEqual({
      ok: false,
      reason: "ALREADY_REFUNDED",
    });
    expect(
      checkRefund({ status: "pending_payment", providerSessionId: "cs_1", hasRefund: false }),
    ).toEqual({
      ok: false,
      reason: "NOT_PAID",
    });
    expect(checkRefund({ status: "paid", providerSessionId: null, hasRefund: false })).toEqual({
      ok: false,
      reason: "NO_PAYMENT_REFERENCE",
    });
  });

  it("only pending orders can be cancelled", () => {
    expect(canCancel({ status: "pending_payment" })).toBe(true);
    expect(canCancel({ status: "paid" })).toBe(false);
    expect(canCancel({ status: "cancelled" })).toBe(false);
  });

  it("masks provider references", () => {
    expect(maskReference("mock_cs_abcdefghijklmnopqrstuvwxyz")).toBe("mock_cs_abcd…wxyz");
    expect(maskReference(null)).toBe("—");
    expect(maskReference("short")).toBe("shor…");
  });
});

describe("password policy and hashing", () => {
  it.each([
    ["short", false],
    ["a".repeat(12), false],
    ["password1234", false],
    ["x".repeat(129), false],
    ["correct horse battery", true],
    ["Zp3!vB8#qL1m", true],
  ])("policy(%j) ok=%s", (pw, ok) => expect(checkPasswordPolicy(pw).ok).toBe(ok));

  it("rejects passwords containing the email name", () => {
    expect(checkPasswordPolicy("mona-example-2026!", "mona.example@example.com").ok).toBe(true);
    expect(checkPasswordPolicy("my-monaexample-pw", "monaexample@example.com").ok).toBe(false);
  });

  it("generated passwords pass the policy and differ", () => {
    const a = generatePassword();
    const b = generatePassword();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(checkPasswordPolicy(a).ok).toBe(true);
  });

  it("hashes with argon2id and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "correct horse battery")).toBe(true);
    expect(await verifyPassword(h, "wrong horse battery")).toBe(false);
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("sessions and lockout", () => {
  const t0 = new Date("2026-11-21T08:00:00Z");
  const at = (ms: number) => new Date(t0.getTime() + ms);

  it("tokens are 256-bit, only their hash is stored", () => {
    const t = newSessionToken();
    expect(isSessionTokenShape(t)).toBe(true);
    expect(isSessionTokenShape("../etc")).toBe(false);
    expect(isSessionTokenShape(undefined)).toBe(false);
    expect(hashSessionToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(t)).not.toContain(t);
  });

  it("expires after 30 minutes idle or 12 hours in total", () => {
    const s = { createdAt: t0, lastSeenAt: t0, expiresAt: absoluteExpiry(t0) };
    expect(sessionState(s, at(SESSION_IDLE_MS - 1))).toBe("valid");
    expect(sessionState(s, at(SESSION_IDLE_MS))).toBe("idle_expired");
    const active = { ...s, lastSeenAt: at(SESSION_ABSOLUTE_MS - 60_000) };
    expect(sessionState(active, at(SESSION_ABSOLUTE_MS - 1))).toBe("valid");
    expect(sessionState(active, at(SESSION_ABSOLUTE_MS))).toBe("absolute_expired");
  });

  it("touches lastSeenAt at most once a minute", () => {
    expect(shouldTouch({ lastSeenAt: t0 }, at(59_000))).toBe(false);
    expect(shouldTouch({ lastSeenAt: t0 }, at(60_000))).toBe(true);
  });

  it("locks for 15 minutes on the 5th failure and resets the counter", () => {
    expect(afterFailedLogin(0, t0)).toEqual({ failedLogins: 1, lockedUntil: null });
    expect(afterFailedLogin(3, t0)).toEqual({ failedLogins: 4, lockedUntil: null });
    const locked = afterFailedLogin(4, t0);
    expect(locked.failedLogins).toBe(0);
    expect(locked.lockedUntil?.getTime()).toBe(t0.getTime() + LOCKOUT_MS);
    expect(isLocked(locked.lockedUntil, at(LOCKOUT_MS - 1))).toBe(true);
    expect(isLocked(locked.lockedUntil, at(LOCKOUT_MS))).toBe(false);
    expect(isLocked(null, t0)).toBe(false);
  });
});

describe("upload checks", () => {
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
  const gif = new TextEncoder().encode("GIF89a....");
  const svg = new TextEncoder().encode("<svg xmlns=");

  it("detects the real type from magic bytes", () => {
    expect(detectImageType(jpg)).toBe("jpeg");
    expect(detectImageType(png)).toBe("png");
    expect(detectImageType(webp)).toBe("webp");
    expect(detectImageType(gif)).toBeNull();
    expect(detectImageType(svg)).toBeNull();
  });

  it("enforces size and type", () => {
    expect(checkUpload({ size: 0 }, jpg).ok).toBe(false);
    expect(checkUpload({ size: MAX_UPLOAD_BYTES + 1 }, jpg)).toEqual({
      ok: false,
      error: "Images must be 5 MB or smaller.",
    });
    expect(checkUpload({ size: 1000 }, svg).ok).toBe(false);
    expect(checkUpload({ size: 1000 }, png)).toEqual({ ok: true, type: "png" });
  });

  it("serves only generated media names", () => {
    expect(MEDIA_FILE_RE.test("p-0123456789abcdef01234567-600.webp")).toBe(true);
    expect(MEDIA_FILE_RE.test("../../.env")).toBe(false);
    expect(MEDIA_FILE_RE.test("p-0123456789abcdef01234567-600.svg")).toBe(false);
  });
});

describe("product form", () => {
  it("parses prices to integer cents", () => {
    expect(parsePriceToCents("24")).toBe(2400);
    expect(parsePriceToCents("24.5")).toBe(2450);
    expect(parsePriceToCents("$24.05")).toBe(2405);
    expect(parsePriceToCents("24.055")).toBeNull();
    expect(parsePriceToCents("-1")).toBeNull();
    expect(parsePriceToCents("1e3")).toBeNull();
  });

  const valid = {
    name: "Tide Wool Throw",
    slug: "",
    shortDescription: "A soft wool throw.",
    description: "A soft, warm wool throw in river blue for the sofa.",
    price: "96.00",
    compareAt: "",
    stock: "4",
    categoryId: "cat1",
    isActive: "on",
    isFeatured: "",
  };

  it("fills the slug from the name and converts values", () => {
    const r = productFormSchema.parse(valid);
    expect(r).toMatchObject({
      slug: "tide-wool-throw",
      priceCents: 9600,
      compareAtCents: null,
      stock: 4,
      isActive: true,
      isFeatured: false,
    });
  });

  it("rejects a compare-at price that isn't higher, and bad slugs", () => {
    const r = productFormSchema.safeParse({ ...valid, compareAt: "90.00", slug: "Bad Slug!" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["compareAt", "slug"]));
  });
});

describe("stock reasons", () => {
  it("received/return add, damaged removes, correction goes either way", () => {
    expect(reasonAllowsDelta("received", 3)).toBe(true);
    expect(reasonAllowsDelta("received", -3)).toBe(false);
    expect(reasonAllowsDelta("return", 1)).toBe(true);
    expect(reasonAllowsDelta("damaged", -1)).toBe(true);
    expect(reasonAllowsDelta("damaged", 1)).toBe(false);
    expect(reasonAllowsDelta("correction", -2)).toBe(true);
    expect(reasonAllowsDelta("correction", 0)).toBe(false);
    expect(reasonAllowsDelta("correction", 1.5)).toBe(false);
  });
});

describe("refunds through the provider interface", () => {
  function fakeStripe(session: Record<string, unknown>) {
    const retrieve = vi.fn(async () => session);
    const refundsCreate = vi.fn(async () => ({ id: "re_test_123" }));
    const client = {
      checkout: { sessions: { create: vi.fn(), expire: vi.fn(), retrieve } },
      refunds: { create: refundsCreate },
    } as unknown as StripeCheckoutClient;
    return { client, retrieve, refundsCreate };
  }
  const input = { orderId: "order_1", sessionId: "cs_test_1", amountCents: 4995, currency: "USD" };
  const KEY = ["sk", "test", "unit"].join("_");

  it("Stripe: refunds the session's PaymentIntent once per order (idempotency key)", async () => {
    const { client, retrieve, refundsCreate } = fakeStripe({
      payment_intent: "pi_123",
      payment_status: "paid",
      amount_total: 4995,
      currency: "usd",
    });
    const res = await new StripeProvider(KEY, client).refundPayment(input);
    expect(res).toEqual({ refundId: "re_test_123" });
    expect(retrieve).toHaveBeenCalledWith("cs_test_1");
    expect(refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_123", metadata: { orderId: "order_1" } },
      { idempotencyKey: "refund-order_1" },
    );
  });

  it("Stripe: refuses when the session isn't paid or the amount differs", async () => {
    const unpaid = fakeStripe({
      payment_intent: "pi_1",
      payment_status: "unpaid",
      amount_total: 4995,
      currency: "usd",
    });
    await expect(
      new StripeProvider(KEY, unpaid.client).refundPayment(input),
    ).rejects.toBeInstanceOf(RefundError);
    expect(unpaid.refundsCreate).not.toHaveBeenCalled();
    const wrong = fakeStripe({
      payment_intent: "pi_1",
      payment_status: "paid",
      amount_total: 100,
      currency: "usd",
    });
    await expect(new StripeProvider(KEY, wrong.client).refundPayment(input)).rejects.toThrow(
      /amount/,
    );
    expect(wrong.refundsCreate).not.toHaveBeenCalled();
  });

  it("Mock: always succeeds with a mock refund id", async () => {
    const res = await new MockProvider().refundPayment(input);
    expect(res.refundId).toMatch(/^mock_re_/);
  });
});

describe("dashboard and audit helpers", () => {
  it("buckets paid orders into zero-filled UTC days", () => {
    const now = new Date("2026-11-21T10:00:00Z");
    const days = revenueByDay(
      [
        { paidAt: new Date("2026-11-21T01:00:00Z"), totalCents: 1000 },
        { paidAt: new Date("2026-11-21T23:00:00Z"), totalCents: 500 },
        { paidAt: new Date("2026-11-19T12:00:00Z"), totalCents: 250 },
        { paidAt: new Date("2026-10-01T12:00:00Z"), totalCents: 999 }, // outside the window
      ],
      now,
      7,
    );
    expect(days).toHaveLength(7);
    expect(days[0]!.day).toBe("2026-11-15");
    expect(days[6]).toEqual({ day: "2026-11-21", revenueCents: 1500, orders: 2 });
    expect(days[4]).toEqual({ day: "2026-11-19", revenueCents: 250, orders: 1 });
    expect(days.reduce((s, d) => s + d.revenueCents, 0)).toBe(1750);
  });

  it("audit summaries list only changed fields and render as plain text", () => {
    const ch = changedFields(
      { priceCents: 2400, name: "Mug", isActive: true },
      { priceCents: 2600, name: "Mug" },
      ["priceCents", "name", "isActive"],
    );
    expect(ch).toEqual({ priceCents: [2400, 2600] });
    expect(summaryText(JSON.stringify({ changes: ch }))).toBe("changed priceCents: 2400 → 2600");
    expect(summaryText(JSON.stringify({ email: "a***@e***.com", reason: "wrong_password" }))).toBe(
      "email: a***@e***.com · reason: wrong_password",
    );
    expect(summaryText("not json")).toBe("");
  });
});
