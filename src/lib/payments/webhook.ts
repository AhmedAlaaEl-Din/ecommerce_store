/**
 * The ONE code path that finishes a payment, for Stripe and the mock provider.
 *
 * 1. Verify the signature over the raw body (events.ts).
 * 2. Idempotency: the event id is inserted into ProcessedEvent in the same
 *    transaction as the order change. A duplicate delivery hits the primary key
 *    and is acknowledged without doing anything.
 * 3. Apply the transition: paid, payment_failed or expired (stock released).
 * 4. After commit, side effects that must not run twice (the confirmation
 *    "email") run only for the first successful payment.
 */
import type { Db } from "../db";
import { markOrderPaidInTx, releaseOrderInTx, type PaidResult } from "../orders/service";
import { verifyAndParseEvent, type PaymentEvent } from "./events";

export type WebhookOutcome =
  | { status: "processed"; action: "paid"; orderId: string; paid: PaidResult }
  | { status: "processed"; action: "released"; orderId: string; released: boolean }
  | { status: "processed"; action: "ignored"; reason: string }
  | { status: "duplicate" };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

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
      await tx.processedEvent.create({ data: { id: event.id, type: event.type.slice(0, 100) } });

      const order = event.orderId
        ? await tx.order.findUnique({
            where: { id: event.orderId },
            select: { id: true, providerSessionId: true },
          })
        : null;
      // The session id must match the one we stored: a valid signature alone
      // is not enough to touch an arbitrary order.
      if (!order || order.providerSessionId !== event.sessionId) {
        return { status: "processed", action: "ignored", reason: "unknown order or session" };
      }

      switch (event.type) {
        case "checkout.session.completed":
          if (event.paymentStatus !== "paid") {
            // Delayed payment methods: wait for async_payment_succeeded/failed.
            return { status: "processed", action: "ignored", reason: "awaiting async payment" };
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
          return { status: "processed", action: "ignored", reason: "unhandled event type" };
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
  if (
    outcome.status === "processed" &&
    outcome.action === "paid" &&
    outcome.paid !== "already_paid"
  ) {
    try {
      await deps.onPaid?.(outcome.orderId);
    } catch (err) {
      // The payment is recorded; a failed confirmation email must not fail the webhook.
      console.error(
        "[webhook] confirmation email failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return outcome;
}
