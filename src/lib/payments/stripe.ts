/**
 * Stripe Checkout (hosted page) in TEST mode.
 *
 * - Line items come from the order, whose prices were read from the database.
 * - client_reference_id and metadata.orderId tie the session back to the order.
 * - The idempotency key is per order, so a retried request never creates two sessions.
 * - The session expires shortly after the stock reservation (Stripe requires at
 *   least 30 minutes), so a late payment is rare and is handled by the webhook.
 *
 * The Stripe client is injectable so unit tests can pass a fake and never touch
 * the network.
 */
import Stripe from "stripe";
import type { CheckoutSession, CheckoutSessionInput, PaymentProvider } from "./types";

/** Stripe's minimum lifetime for a Checkout Session. */
const MIN_SESSION_SECONDS = 30 * 60;

export type StripeCheckoutClient = {
  checkout: {
    sessions: {
      create: Stripe["checkout"]["sessions"]["create"];
      expire: Stripe["checkout"]["sessions"]["expire"];
    };
  };
};

export function sessionExpiresAt(reservedUntil: Date, now = new Date()): number {
  const minimum = Math.floor(now.getTime() / 1000) + MIN_SESSION_SECONDS + 60;
  return Math.max(Math.floor(reservedUntil.getTime() / 1000) + 60, minimum);
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private readonly client: StripeCheckoutClient;

  constructor(secretKey: string, client?: StripeCheckoutClient) {
    this.client = client ?? new Stripe(secretKey, { maxNetworkRetries: 1, timeout: 15_000 });
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    const currency = input.currency.toLowerCase();
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((l) => ({
      quantity: l.quantity,
      price_data: { currency, unit_amount: l.unitAmountCents, product_data: { name: l.name } },
    }));
    if (input.shippingCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: input.shippingCents,
          product_data: { name: "Shipping" },
        },
      });
    }

    const session = await this.client.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        customer_email: input.email,
        client_reference_id: input.orderId,
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
        payment_intent_data: { metadata: { orderId: input.orderId } },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: sessionExpiresAt(input.reservedUntil),
      },
      { idempotencyKey: `checkout-session-${input.orderId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return { sessionId: session.id, redirectUrl: session.url };
  }

  async cancelSession(sessionId: string): Promise<void> {
    try {
      await this.client.checkout.sessions.expire(sessionId);
    } catch {
      // Already completed or expired: nothing to do.
    }
  }
}
