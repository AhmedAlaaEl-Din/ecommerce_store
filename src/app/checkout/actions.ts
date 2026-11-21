"use server";

/**
 * Checkout server actions. Server actions are POST-only and Next.js checks the
 * Origin header against the host, which is the CSRF protection here.
 *
 * Only the shopper's contact and address come from the form. Lines, prices,
 * totals and stock are read from the database (lib/orders/service.ts).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readCartId } from "@/lib/cart/cookie";
import { db } from "@/lib/db";
import { logError, logInfo, maskEmail } from "@/lib/log";
import {
  readCheckoutForm,
  validateCheckout,
  type CheckoutFieldErrors,
  type CheckoutValues,
} from "@/lib/orders/checkout-schema";
import { attachProviderSession, createPendingOrder, releaseOrder } from "@/lib/orders/service";
import { getPayments } from "@/lib/payments";
import { PaymentConfigError } from "@/lib/payments/config";
import { checkoutLimiter } from "@/lib/rate-limit";
import { appUrl } from "@/lib/site";

export type CheckoutState = {
  values: CheckoutValues;
  errors: CheckoutFieldErrors;
  formError?: string;
  /** Increments on every failed submit so the client can move focus. */
  attempt: number;
};

async function clientKey(cartId: string | null): Promise<string> {
  if (cartId) return `cart:${cartId}`;
  if (process.env.TRUST_PROXY === "true") {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) return `ip:${ip}`;
  }
  return "anonymous";
}

export async function placeOrderAction(
  prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const values = readCheckoutForm(formData);
  const attempt = (prev?.attempt ?? 0) + 1;
  const cartId = await readCartId();

  if (!checkoutLimiter.take(await clientKey(cartId))) {
    return {
      values,
      errors: {},
      attempt,
      formError: "Too many attempts in a short time. Please wait a minute and try again.",
    };
  }

  const valid = validateCheckout(values);
  if (!valid.ok) {
    return {
      values,
      errors: valid.errors,
      attempt,
      formError: "Please check the highlighted fields.",
    };
  }

  let payments: ReturnType<typeof getPayments>;
  try {
    payments = getPayments();
  } catch (err) {
    logError("checkout", "payment configuration error", err);
    return {
      values,
      errors: {},
      attempt,
      formError:
        err instanceof PaymentConfigError
          ? "Payments are not configured on this server yet. Please try again later."
          : "Something went wrong on our side. Please try again.",
    };
  }

  let result: Awaited<ReturnType<typeof createPendingOrder>>;
  try {
    result = await createPendingOrder(db, {
      cartId,
      customer: valid.data,
      provider: payments.config.provider,
    });
  } catch (err) {
    // Logged without the query arguments (they contain the address).
    logError("checkout", "could not create the order", err);
    return {
      values,
      errors: {},
      attempt,
      formError: "Something went wrong on our side. Nothing was charged. Please try again.",
    };
  }
  if (!result.ok) {
    if (result.code === "EMPTY_CART") redirect("/cart");
    if (result.code === "MIXED_CURRENCY") {
      return {
        values,
        errors: {},
        attempt,
        formError: "Your cart mixes currencies, which we can’t charge together. Please contact us.",
      };
    }
    const ids = result.changes.map((c) => c.productId).join(".");
    redirect(`/cart?adjusted=${encodeURIComponent(ids)}`);
  }

  const { order } = result;
  // A resubmit replaced an earlier pending order: make its session unpayable.
  for (const old of result.supersededSessionIds) {
    await payments.provider.cancelSession(old);
  }
  let redirectUrl: string;
  try {
    const session = await payments.provider.createCheckoutSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      currency: order.currency,
      lines: order.lines,
      shippingCents: order.shippingCents,
      successUrl: `${appUrl()}/order/${order.publicToken}`,
      cancelUrl: `${appUrl()}/checkout/cancel?order=${order.publicToken}`,
      reservedUntil: order.reservedUntil,
    });
    await attachProviderSession(db, order.id, session.sessionId);
    redirectUrl = session.redirectUrl;
  } catch (err) {
    logError("checkout", `could not start payment for ${order.orderNumber}`, err);
    await releaseOrder(db, order.id, "cancelled");
    return {
      values,
      errors: {},
      attempt,
      formError: "We couldn’t start the payment. Nothing was charged. Please try again.",
    };
  }

  logInfo("checkout", "order created", {
    order: order.orderNumber,
    email: maskEmail(order.email),
    provider: payments.config.provider,
  });
  redirect(redirectUrl);
}
