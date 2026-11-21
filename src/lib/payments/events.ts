/**
 * Webhook events in Stripe's format, shared by both providers.
 *
 * Signing and verification use Stripe's own webhook helpers
 * (`Stripe.webhooks`), which work offline: real Stripe events are verified with
 * STRIPE_WEBHOOK_SECRET, and mock events are signed and verified the same way
 * with the mock secret. One code path handles both.
 */
import Stripe from "stripe";
import { z } from "zod";

export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  /** Mock-only: the "Decline (test failure)" button. */
  "payment_failed",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

/** The few fields we read from a Checkout Session event (everything else is ignored). */
const sessionEventSchema = z.object({
  id: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  data: z.object({
    object: z.object({
      id: z.string().min(1).max(255),
      client_reference_id: z.string().max(255).nullish(),
      payment_status: z.string().max(50).nullish(),
      metadata: z.record(z.string(), z.string()).nullish(),
    }),
  }),
});

export type PaymentEvent = {
  id: string;
  type: string;
  sessionId: string;
  orderId: string | null;
  paymentStatus: string | null;
};

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class WebhookPayloadError extends Error {
  constructor(message = "Unexpected webhook payload") {
    super(message);
    this.name = "WebhookPayloadError";
  }
}

/** Builds the `Stripe-Signature` header for a payload (used by the mock provider and tests). */
export function signPayload(payload: string, secret: string, timestamp?: number): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });
}

/**
 * Verifies the signature over the RAW body (not re-serialised JSON) and returns
 * the parsed event. Throws WebhookSignatureError or WebhookPayloadError.
 */
export function verifyAndParseEvent(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): PaymentEvent {
  if (!signatureHeader) throw new WebhookSignatureError("Missing Stripe-Signature header");
  let event: unknown;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
  } catch {
    throw new WebhookSignatureError();
  }
  const parsed = sessionEventSchema.safeParse(event);
  if (!parsed.success) throw new WebhookPayloadError();
  const session = parsed.data.data.object;
  return {
    id: parsed.data.id,
    type: parsed.data.type,
    sessionId: session.id,
    orderId: session.metadata?.orderId ?? session.client_reference_id ?? null,
    paymentStatus: session.payment_status ?? null,
  };
}

/** Builds a Stripe-shaped event payload (mock provider and tests). */
export function buildSessionEvent(input: {
  eventId: string;
  type: HandledEventType | string;
  sessionId: string;
  orderId: string;
  paymentStatus?: "paid" | "unpaid";
  created?: number;
}): string {
  return JSON.stringify({
    id: input.eventId,
    object: "event",
    type: input.type,
    created: input.created ?? Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: input.sessionId,
        object: "checkout.session",
        client_reference_id: input.orderId,
        payment_status: input.paymentStatus ?? "unpaid",
        metadata: { orderId: input.orderId },
      },
    },
  });
}
