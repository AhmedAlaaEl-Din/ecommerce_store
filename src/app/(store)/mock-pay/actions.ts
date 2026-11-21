"use server";

/**
 * Buttons on the mock payment page. They build a Stripe-shaped event, sign it
 * with the same helper Stripe's events are verified with, and hand the raw body
 * and signature header to `receiveWebhook`, the function behind
 * /api/webhooks/payments. So the mock goes through exactly the same rate limit,
 * signature verification, idempotency and order handling as real Stripe events.
 * (In-process rather than an HTTP call to ourselves: no dependence on how
 * "localhost" resolves on the machine.)
 */
import { after } from "next/server";
import { redirect } from "next/navigation";
import { readCartId } from "@/lib/cart/cookie";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { getPayments } from "@/lib/payments";
import { isMockAllowed } from "@/lib/payments/config";
import { buildSessionEvent, signPayload } from "@/lib/payments/events";
import { MOCK_SESSION_ID_RE, newMockEventId } from "@/lib/payments/mock";
import { mockPayLimiter } from "@/lib/rate-limit";
import { receiveWebhook } from "@/lib/payments/receive";

/** Like Stripe, the "paid" webhook arrives shortly after the shopper is redirected. */
function paidDelayMs(): number {
  const n = Number(process.env.MOCK_WEBHOOK_DELAY_MS ?? "1500");
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 10_000) : 1500;
}

async function findPendingMockOrder(sessionId: unknown) {
  if (typeof sessionId !== "string" || !MOCK_SESSION_ID_RE.test(sessionId)) return null;
  if (!isMockAllowed()) return null;
  const { config } = getPayments();
  if (config.provider !== "mock") return null;
  const order = await db.order.findUnique({
    where: { providerSessionId: sessionId },
    select: {
      id: true,
      publicToken: true,
      status: true,
      provider: true,
      totalCents: true,
      currency: true,
    },
  });
  if (!order || order.provider !== "mock") return null;
  return { order, secret: config.webhookSecret };
}

/** Hands the signed event to the webhook receiver (the same function the route uses). */
async function postEvent(payload: string, secret: string): Promise<boolean> {
  try {
    const res = await receiveWebhook(payload, signPayload(payload, secret));
    if (res.status !== 200) logError("mock-pay", `webhook responded ${res.status}`);
    return res.status === 200;
  } catch (err) {
    logError("mock-pay", "webhook delivery failed", err);
    return false;
  }
}

async function throttled(): Promise<boolean> {
  const cartId = await readCartId();
  return !mockPayLimiter.take(cartId ? `cart:${cartId}` : "anonymous");
}

export async function mockPayAction(formData: FormData): Promise<void> {
  const sessionId = formData.get("sessionId");
  if (await throttled()) redirect(`/mock-pay/${String(sessionId)}?error=busy`);
  const found = await findPendingMockOrder(sessionId);
  if (!found) redirect("/cart");
  const { order, secret } = found;
  if (order.status !== "pending_payment") redirect(`/order/${order.publicToken}`);

  const payload = buildSessionEvent({
    eventId: newMockEventId(),
    type: "checkout.session.completed",
    sessionId: sessionId as string,
    orderId: order.id,
    paymentStatus: "paid",
    amountTotal: order.totalCents,
    currency: order.currency,
  });
  const delay = paidDelayMs();
  after(async () => {
    await new Promise((r) => setTimeout(r, delay));
    await postEvent(payload, secret);
  });
  redirect(`/order/${order.publicToken}`);
}

export async function mockDeclineAction(formData: FormData): Promise<void> {
  const sessionId = formData.get("sessionId");
  if (await throttled()) redirect(`/mock-pay/${String(sessionId)}?error=busy`);
  const found = await findPendingMockOrder(sessionId);
  if (!found) redirect("/cart");
  const { order, secret } = found;
  if (order.status === "pending_payment") {
    const payload = buildSessionEvent({
      eventId: newMockEventId(),
      type: "payment_failed",
      sessionId: sessionId as string,
      orderId: order.id,
    });
    // Delivered before redirecting, so the checkout page already shows the outcome.
    const ok = await postEvent(payload, secret);
    if (!ok) redirect(`/mock-pay/${String(sessionId)}?error=webhook`);
  }
  redirect(`/checkout?order=${order.publicToken}&status=failed`);
}
