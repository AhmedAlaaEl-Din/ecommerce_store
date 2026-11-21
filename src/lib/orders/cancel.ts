import "server-only";
import { db } from "../db";
import { getPayments } from "../payments";
import { getOrderByToken, releaseOrder } from "./service";

/**
 * Cancels a pending order (shopper pressed Cancel on the payment page) and
 * releases its stock. Shared by /checkout/cancel (Stripe's cancel_url) and the
 * mock pay page.
 */
export async function cancelPendingOrder(
  publicToken: string,
  cartId: string | null,
): Promise<boolean> {
  const order = await getOrderByToken(db, publicToken);
  if (!order || order.status !== "pending_payment") return false;
  // Holding the token is not enough: the request must also come from the browser
  // whose cart placed the order (the SameSite=Lax cart cookie is sent on the
  // top-level redirect back from Stripe). Link scanners cannot cancel orders.
  if (!cartId || order.cartId !== cartId) return false;
  const released = await releaseOrder(db, order.id, "cancelled");
  if (released && order.providerSessionId) {
    try {
      await getPayments().provider.cancelSession(order.providerSessionId);
    } catch {
      // Best effort: an unpaid Stripe session also expires on its own.
    }
  }
  return released;
}
