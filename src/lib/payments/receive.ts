import "server-only";
/**
 * Everything the webhook route does with a request, as a function: rate limit,
 * size check, signature verification, idempotent handling and the confirmation
 * email. /api/webhooks/payments calls it with Stripe's (or anyone's) request;
 * the mock pay page calls it with the event it just signed. Same code, same checks.
 */
import { db } from "../db";
import { logError, logInfo, logWarn } from "../log";
import { writeConfirmationEmail } from "../orders/outbox";
import { webhookLimiter } from "../rate-limit";
import { getPayments } from "./index";
import { WebhookPayloadError, WebhookSignatureError } from "./events";
import { handleWebhook, WebhookRetryError } from "./webhook";

export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export type ReceiveResult = { status: number; body: Record<string, unknown> };

export async function receiveWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<ReceiveResult> {
  // Rate limiting applies to REJECTED requests only (bad signature or payload):
  // junk traffic cannot use up the budget and make genuine, signed provider
  // deliveries fail. Checking an HMAC is cheap, so verifying first is fine.
  const rejected = (body: Record<string, unknown>): ReceiveResult =>
    webhookLimiter.take("rejected")
      ? { status: 400, body }
      : { status: 429, body: { error: "rate_limited" } };
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return { status: 413, body: { error: "too_large" } };
  }

  try {
    const { config } = getPayments();
    const outcome = await handleWebhook(rawBody, signatureHeader, {
      db,
      secret: config.webhookSecret,
      onPaid: async (orderId) => {
        await writeConfirmationEmail(db, orderId);
      },
    });
    logInfo("webhook", "event handled", {
      status: outcome.status,
      action: outcome.status === "processed" ? outcome.action : undefined,
    });
    return { status: 200, body: { received: true, duplicate: outcome.status === "duplicate" } };
  } catch (err) {
    if (err instanceof WebhookSignatureError) return rejected({ error: "invalid_signature" });
    if (err instanceof WebhookPayloadError) return rejected({ error: "invalid_payload" });
    if (err instanceof WebhookRetryError) {
      logWarn("webhook", `retry requested: ${err.message}`);
      return { status: 500, body: { error: "retry_later" } };
    }
    logError("webhook", "handler failed", err);
    // 500 makes Stripe retry later; the event id was not recorded.
    return { status: 500, body: { error: "server_error" } };
  }
}
