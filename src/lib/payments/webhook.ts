/**
 * The ONE code path that finishes a payment, for Stripe and the mock provider.
 *
 * 1. Verify the signature over the raw body (events.ts).
 * 2. Match the event to an order: the order id AND the stored session id must
 *    agree, the event must not be live-mode, and a paid amount must equal the
 *    order total. Events that cannot be matched are not recorded.
 * 3. Idempotency: the event id is inserted into ProcessedEvent in the same
 *    transaction as the order change. A duplicate delivery is acknowledged
 *    without doing anything.
 * 4. Apply the transition: paid, payment_failed or expired (stock released).
 * 5. After commit, side effects that must not run twice (the confirmation
 *    "email") run only for the first successful payment.
 */
import type { Db } from "../db";
import { logError, logWarn } from "../log";
import { markOrderPaidInTx, releaseOrderInTx, type PaidResult } from "../orders/service";
import { verifyAndParseEvent, type PaymentEvent } from "./events";

export type WebhookOutcome =
  | { status: "processed"; action: "paid"; orderId: string; paid: PaidResult }
  | { status: "processed"; action: "released"; orderId: string; released: boolean }
  | { status: "processed"; action: "ignored"; reason: string }
  | { status: "duplicate" };

/** Thrown when an event should be retried later (the route answers 500). */
export class WebhookRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookRetryError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

const ignored = (reason: string): WebhookOutcome => ({
  status: "processed",
  action: "ignored",
  reason,
});

/** Applies a verified event. Exported for tests; production goes through handleWebhook. */
export async function applyPaymentEvent(
  db: Db,
  event: PaymentEvent,
  now = new Date(),
): Promise<WebhookOutcome> {
  try {
    return await db.$transaction(async (tx): Promise<WebhookOutcome> => {
      // Idempotency guard. Transactions on the shared client are serialised, so
      // check-then-insert is race-free in-process; the primary key (P2002, below)
      // is the backstop across processes.
      const seen = await tx.processedEvent.findUnique({
        where: { id: event.id },
        select: { id: true },
      });
      if (seen) return { status: "duplicate" };

      const order = event.orderId
        ? await tx.order.findUnique({
            where: { id: event.orderId },
            select: { id: true, providerSessionId: true, totalCents: true, currency: true },
          })
        : null;
      // Not recorded as processed: an event we cannot match is never "used up".
      if (!order) return ignored("unknown order");
      if (order.providerSessionId === null) {
        // The session id is stored right after the session is created; a very
        // early event gets a 500 so the provider retries it.
        throw new WebhookRetryError("order has no session yet");
      }
      // A valid signature alone is not enough to touch an arbitrary order.
      if (order.providerSessionId !== event.sessionId) return ignored("session does not match");
      if (event.livemode === true) return ignored("live-mode event refused");

      await tx.processedEvent.create({ data: { id: event.id, type: event.type.slice(0, 100) } });

      const isPaidEvent =
        (event.type === "checkout.session.completed" && event.paymentStatus === "paid") ||
        event.type === "checkout.session.async_payment_succeeded";
      const amountMismatch = event.amountTotal !== null && event.amountTotal !== order.totalCents;
      const currencyMismatch =
        event.currency !== null && event.currency.toLowerCase() !== order.currency.toLowerCase();
      if (isPaidEvent && (amountMismatch || currencyMismatch)) {
        // Defence in depth: the provider charged something other than the order total.
        logWarn("webhook", `amount/currency mismatch on order ${order.id}; not marked paid`);
        return ignored("amount or currency mismatch");
      }

      switch (event.type) {
        case "checkout.session.completed":
          if (event.paymentStatus !== "paid") {
            // Delayed payment methods: wait for async_payment_succeeded/failed.
            return ignored("awaiting async payment");
          }
        // falls through
        case "checkout.session.async_payment_succeeded": {
          const paid = await markOrderPaidInTx(tx, order.id, now);
          return { status: "processed", action: "paid", orderId: order.id, paid };
        }
        case "checkout.session.async_payment_failed":
        case "payment_failed": {
          const released = await releaseOrderInTx(tx, order.id, "payment_failed");
          return { status: "processed", action: "released", orderId: order.id, released };
        }
        case "checkout.session.expired": {
          const released = await releaseOrderInTx(tx, order.id, "expired");
          return { status: "processed", action: "released", orderId: order.id, released };
        }
        default:
          return ignored("unhandled event type");
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { status: "duplicate" };
    throw err;
  }
}

export type WebhookDeps = {
  db: Db;
  secret: string;
  /** Runs once after the first successful payment of an order (writes the outbox email). */
  onPaid?: (orderId: string) => Promise<void>;
  now?: Date;
};

/** Verifies and applies a raw webhook request body. Throws on a bad signature or payload. */
export async function handleWebhook(
  rawBody: string,
  signatureHeader: string | null,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  const event = verifyAndParseEvent(rawBody, signatureHeader, deps.secret);
  const outcome = await applyPaymentEvent(deps.db, event, deps.now);
  if (outcome.status === "processed" && outcome.action === "paid") {
    if (outcome.paid === "paid_after_release" || outcome.paid === "paid_oversold") {
      // Also stored on the order (fulfilmentNote) for manual follow-up.
      logWarn("webhook", `late payment on order ${outcome.orderId}: ${outcome.paid}`);
    }
    if (outcome.paid !== "already_paid") {
      try {
        await deps.onPaid?.(outcome.orderId);
      } catch (err) {
        // The payment is recorded; a failed confirmation email must not fail the webhook.
        logError("webhook", "confirmation email failed", err);
      }
    }
  }
  return outcome;
}
