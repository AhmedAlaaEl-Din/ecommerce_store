/**
 * Pure order rules for the admin (unit-tested): the fulfilment state machine,
 * and when an order may be cancelled or refunded.
 */
export type FulfilmentStatus = "unfulfilled" | "packed" | "shipped" | "delivered";
export type PaymentStatus =
  | "pending_payment"
  | "paid"
  | "payment_failed"
  | "cancelled"
  | "expired"
  | "refunded";

export const FULFILMENT_STEPS: readonly FulfilmentStatus[] = [
  "unfulfilled",
  "packed",
  "shipped",
  "delivered",
];

export const FULFILMENT_LABELS: Record<FulfilmentStatus, string> = {
  unfulfilled: "Unfulfilled",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
};

/** The one status an order can move to next, or null when there is none. */
export function nextFulfilment(current: FulfilmentStatus): FulfilmentStatus | null {
  const i = FULFILMENT_STEPS.indexOf(current);
  return i >= 0 && i < FULFILMENT_STEPS.length - 1 ? FULFILMENT_STEPS[i + 1]! : null;
}

export type TransitionCheck =
  | { ok: true }
  | { ok: false; reason: "NOT_PAID" | "INVALID_STEP" | "TRACKING_REQUIRED" };

/**
 * Fulfilment moves one step at a time, only for paid orders, and "shipped"
 * needs a carrier and a tracking number.
 */
export function checkFulfilmentTransition(
  order: { status: PaymentStatus; fulfilmentStatus: FulfilmentStatus },
  to: FulfilmentStatus,
  shipping?: { carrier?: string | null; trackingNumber?: string | null },
): TransitionCheck {
  if (order.status !== "paid") return { ok: false, reason: "NOT_PAID" };
  if (nextFulfilment(order.fulfilmentStatus) !== to) return { ok: false, reason: "INVALID_STEP" };
  if (to === "shipped" && (!shipping?.carrier?.trim() || !shipping?.trackingNumber?.trim())) {
    return { ok: false, reason: "TRACKING_REQUIRED" };
  }
  return { ok: true };
}

export type RefundCheck =
  | { ok: true }
  | { ok: false; reason: "NOT_PAID" | "ALREADY_REFUNDED" | "NO_PAYMENT_REFERENCE" };

/** Full refunds only, once, for a paid order that has a provider payment reference. */
export function checkRefund(order: {
  status: PaymentStatus;
  providerSessionId: string | null;
  hasRefund: boolean;
}): RefundCheck {
  if (order.hasRefund || order.status === "refunded") return { ok: false, reason: "ALREADY_REFUNDED" };
  if (order.status !== "paid") return { ok: false, reason: "NOT_PAID" };
  if (!order.providerSessionId) return { ok: false, reason: "NO_PAYMENT_REFERENCE" };
  return { ok: true };
}

/** Only orders still waiting for payment can be cancelled (paid ones are refunded instead). */
export function canCancel(order: { status: PaymentStatus }): boolean {
  return order.status === "pending_payment";
}

/** "mock_cs_abcdef...xyz" -> "mock_cs_abcd…wxyz" for display. */
export function maskReference(ref: string | null | undefined): string {
  if (!ref) return "—";
  if (ref.length <= 14) return ref.slice(0, 4) + "…";
  return `${ref.slice(0, 12)}…${ref.slice(-4)}`;
}
