import { describe, expect, it, vi } from "vitest";
import {
  DEV_MOCK_WEBHOOK_SECRET,
  getPaymentConfig,
  isMockAllowed,
  PaymentConfigError,
} from "@/lib/payments/config";
import {
  buildSessionEvent,
  signPayload,
  verifyAndParseEvent,
  WebhookPayloadError,
  WebhookSignatureError,
} from "@/lib/payments/events";
import { MOCK_SESSION_ID_RE, MockProvider } from "@/lib/payments/mock";
import { sessionExpiresAt, StripeProvider, type StripeCheckoutClient } from "@/lib/payments/stripe";

// Built at runtime so no key-shaped literal sits in the repo.
const TEST_KEY = ["sk", "test", "unit0000000000"].join("_");
const LIVE_KEY = ["sk", "live", "unit0000000000"].join("_");
const WH_SECRET = ["whsec", "unittestsecret"].join("_");

describe("provider selection", () => {
  it("defaults to the mock provider in development", () => {
    const c = getPaymentConfig({ NODE_ENV: "development" });
    expect(c).toEqual({
      provider: "mock",
      webhookSecret: DEV_MOCK_WEBHOOK_SECRET,
      mockEnabled: true,
    });
  });

  it("uses MOCK_WEBHOOK_SECRET when set", () => {
    const c = getPaymentConfig({ NODE_ENV: "development", MOCK_WEBHOOK_SECRET: "abc" });
    expect(c.webhookSecret).toBe("abc");
  });

  it("disables the mock in production unless ALLOW_MOCK_PAYMENTS=true", () => {
    expect(isMockAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(() => getPaymentConfig({ NODE_ENV: "production" })).toThrow(PaymentConfigError);
    expect(() =>
      getPaymentConfig({
        NODE_ENV: "production",
        PAYMENT_PROVIDER: "mock",
        ALLOW_MOCK_PAYMENTS: "1",
      }),
    ).toThrow(/disabled in production/);
  });

  it("requires a mock secret when the mock is allowed in production", () => {
    expect(() => getPaymentConfig({ NODE_ENV: "production", ALLOW_MOCK_PAYMENTS: "true" })).toThrow(
      /MOCK_WEBHOOK_SECRET/,
    );
    const c = getPaymentConfig({
      NODE_ENV: "production",
      ALLOW_MOCK_PAYMENTS: "true",
      MOCK_WEBHOOK_SECRET: "s3cret",
    });
    expect(c).toMatchObject({ provider: "mock", webhookSecret: "s3cret" });
  });

  it("fails fast when stripe is chosen without keys", () => {
    expect(() => getPaymentConfig({ PAYMENT_PROVIDER: "stripe" })).toThrow(/STRIPE_SECRET_KEY/);
    expect(() =>
      getPaymentConfig({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: TEST_KEY }),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it("refuses live keys", () => {
    expect(() =>
      getPaymentConfig({
        PAYMENT_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: LIVE_KEY,
        STRIPE_WEBHOOK_SECRET: WH_SECRET,
      }),
    ).toThrow(/TEST key/);
  });

  it("accepts stripe with test keys, even in production", () => {
    const c = getPaymentConfig({
      NODE_ENV: "production",
      PAYMENT_PROVIDER: " Stripe ",
      STRIPE_SECRET_KEY: TEST_KEY,
      STRIPE_WEBHOOK_SECRET: WH_SECRET,
    });
    expect(c).toEqual({
      provider: "stripe",
      stripeSecretKey: TEST_KEY,
      webhookSecret: WH_SECRET,
      mockEnabled: false,
    });
  });

  it("rejects unknown providers", () => {
    expect(() => getPaymentConfig({ PAYMENT_PROVIDER: "paypal" })).toThrow(
      /Unknown PAYMENT_PROVIDER/,
    );
  });
});

describe("webhook signature verification", () => {
  const payload = buildSessionEvent({
    eventId: "evt_1",
    type: "checkout.session.completed",
    sessionId: "cs_test_1",
    orderId: "order123456",
    paymentStatus: "paid",
  });

  it("accepts a valid signature and parses the event", () => {
    const header = signPayload(payload, WH_SECRET);
    expect(verifyAndParseEvent(payload, header, WH_SECRET)).toEqual({
      id: "evt_1",
      type: "checkout.session.completed",
      sessionId: "cs_test_1",
      orderId: "order123456",
      paymentStatus: "paid",
    });
  });

  it("rejects a missing or malformed header", () => {
    expect(() => verifyAndParseEvent(payload, null, WH_SECRET)).toThrow(WebhookSignatureError);
    expect(() => verifyAndParseEvent(payload, "nonsense", WH_SECRET)).toThrow(
      WebhookSignatureError,
    );
  });

  it("rejects a signature made with the wrong secret", () => {
    const header = signPayload(payload, "whsec_other");
    expect(() => verifyAndParseEvent(payload, header, WH_SECRET)).toThrow(WebhookSignatureError);
  });

  it("rejects a tampered body (signature covers the raw bytes)", () => {
    const header = signPayload(payload, WH_SECRET);
    const tampered = payload.replace('"paid"', '"unpaid"');
    expect(() => verifyAndParseEvent(tampered, header, WH_SECRET)).toThrow(WebhookSignatureError);
    // Re-serialising (e.g. different whitespace) also breaks it.
    const reformatted = JSON.stringify(JSON.parse(payload), null, 2);
    expect(() => verifyAndParseEvent(reformatted, header, WH_SECRET)).toThrow(
      WebhookSignatureError,
    );
  });

  it("rejects old signatures (replay outside the 5-minute tolerance)", () => {
    const old = Math.floor(Date.now() / 1000) - 60 * 60;
    const header = signPayload(payload, WH_SECRET, old);
    expect(() => verifyAndParseEvent(payload, header, WH_SECRET)).toThrow(WebhookSignatureError);
  });

  it("rejects a correctly signed payload of the wrong shape", () => {
    const odd = JSON.stringify({ id: "evt_2", object: "event", type: "x", data: {} });
    expect(() => verifyAndParseEvent(odd, signPayload(odd, WH_SECRET), WH_SECRET)).toThrow(
      WebhookPayloadError,
    );
  });
});

describe("MockProvider", () => {
  it("creates random session ids and points at the internal mock page", async () => {
    const p = new MockProvider();
    const input = {
      orderId: "o1",
      orderNumber: "NG-2026-000001",
      email: "mona@example.com",
      currency: "USD",
      lines: [],
      shippingCents: 0,
      successUrl: "http://localhost/s",
      cancelUrl: "http://localhost/c",
      reservedUntil: new Date(),
    };
    const a = await p.createCheckoutSession(input);
    const b = await p.createCheckoutSession(input);
    expect(a.sessionId).toMatch(MOCK_SESSION_ID_RE);
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(a.redirectUrl).toBe(`/mock-pay/${a.sessionId}`);
  });
});

describe("StripeProvider (SDK mocked, no network)", () => {
  function fakeClient() {
    const create = vi.fn(async () => ({
      id: "cs_test_abc",
      url: "https://checkout.stripe.test/c/abc",
    }));
    const expire = vi.fn(async () => ({}));
    const client = {
      checkout: { sessions: { create, expire } },
    } as unknown as StripeCheckoutClient;
    return { client, create, expire };
  }

  const now = new Date("2026-11-21T12:00:00Z");
  const input = {
    orderId: "order123456",
    orderNumber: "NG-2026-000042",
    email: "mona@example.com",
    currency: "USD",
    lines: [
      { name: "Tide Wool Throw", unitAmountCents: 9600, quantity: 1 },
      { name: "Basalt Stoneware Mug", unitAmountCents: 1900, quantity: 2 },
    ],
    shippingCents: 595,
    successUrl: "http://localhost:3000/order/tok",
    cancelUrl: "http://localhost:3000/checkout/cancel?order=tok",
    reservedUntil: new Date(now.getTime() + 30 * 60_000),
  };

  it("creates a hosted Checkout Session from server-side prices with an idempotency key", async () => {
    const { client, create } = fakeClient();
    const p = new StripeProvider(TEST_KEY, client);
    const res = await p.createCheckoutSession(input);
    expect(res).toEqual({
      sessionId: "cs_test_abc",
      redirectUrl: "https://checkout.stripe.test/c/abc",
    });
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { idempotencyKey: string },
    ];
    expect(options).toEqual({ idempotencyKey: "checkout-session-order123456" });
    expect(params).toMatchObject({
      mode: "payment",
      customer_email: "mona@example.com",
      client_reference_id: "order123456",
      metadata: { orderId: "order123456", orderNumber: "NG-2026-000042" },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    expect(params.line_items).toEqual([
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 9600,
          product_data: { name: "Tide Wool Throw" },
        },
      },
      {
        quantity: 2,
        price_data: {
          currency: "usd",
          unit_amount: 1900,
          product_data: { name: "Basalt Stoneware Mug" },
        },
      },
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: 595, product_data: { name: "Shipping" } },
      },
    ]);
  });

  it("omits the shipping line when shipping is free", async () => {
    const { client, create } = fakeClient();
    await new StripeProvider(TEST_KEY, client).createCheckoutSession({
      ...input,
      shippingCents: 0,
    });
    const [params] = create.mock.calls[0] as unknown as [{ line_items: unknown[] }];
    expect(params.line_items).toHaveLength(2);
  });

  it("expires sessions at least 30 minutes ahead (Stripe minimum)", () => {
    const soon = new Date(now.getTime() + 60_000);
    expect(sessionExpiresAt(soon, now)).toBe(Math.floor(now.getTime() / 1000) + 31 * 60);
    const later = new Date(now.getTime() + 45 * 60_000);
    expect(sessionExpiresAt(later, now)).toBe(Math.floor(later.getTime() / 1000) + 60);
  });

  it("cancelSession expires the session and swallows errors", async () => {
    const { client, expire } = fakeClient();
    expire.mockRejectedValueOnce(new Error("already expired"));
    await expect(
      new StripeProvider(TEST_KEY, client).cancelSession("cs_test_abc"),
    ).resolves.toBeUndefined();
    expect(expire).toHaveBeenCalledWith("cs_test_abc");
  });

  it("fails clearly if Stripe returns no URL", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValueOnce({ id: "cs_test_x", url: null } as never);
    await expect(new StripeProvider(TEST_KEY, client).createCheckoutSession(input)).rejects.toThrow(
      /Checkout URL/,
    );
  });
});
