/**
 * Payment webhook (Stripe and mock). Protected by the signature, not by
 * cookies/Origin (CSRF does not apply: it is server-to-server and must accept
 * Stripe's requests). The raw body is verified before anything is parsed.
 */
import { db } from "@/lib/db";
import { logError, logInfo } from "@/lib/log";
import { writeConfirmationEmail } from "@/lib/orders/outbox";
import { getPayments } from "@/lib/payments";
import { WebhookPayloadError, WebhookSignatureError } from "@/lib/payments/events";
import { handleWebhook } from "@/lib/payments/webhook";
import { webhookLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!webhookLimiter.take("webhook")) return json(429, { error: "rate_limited" });

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });

  try {
    const { config } = getPayments();
    const outcome = await handleWebhook(rawBody, request.headers.get("stripe-signature"), {
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
    return json(200, { received: true, duplicate: outcome.status === "duplicate" });
  } catch (err) {
    if (err instanceof WebhookSignatureError) return json(400, { error: "invalid_signature" });
    if (err instanceof WebhookPayloadError) return json(400, { error: "invalid_payload" });
    logError("webhook", "handler failed", err);
    // 500 makes Stripe retry later; the event id was not recorded (transaction rolled back).
    return json(500, { error: "server_error" });
  }
}
