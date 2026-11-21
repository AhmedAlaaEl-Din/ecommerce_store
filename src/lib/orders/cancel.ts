import "server-only";
import { db } from "../db";
import { getPayments } from "../payments";
import { getOrderByToken, releaseOrder } from "./service";

/**
 * Cancels a pending order (shopper pressed Cancel on the payment page) and
 * releases its stock. Shared by /checkout/cancel (Stripe's cancel_url) and the
 * mock pay page. Only the holder of the unguessable token can reach it.
 */
export async function cancelPendingOrder(publicToken: string): Promise<boolean> {
  const order = await getOrderByToken(db, publicToken);
  if (!order || order.status !== "pending_payment") return false;
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
