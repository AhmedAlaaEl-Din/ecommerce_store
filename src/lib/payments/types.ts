import type { ProviderName } from "./config";

export type CheckoutLine = {
  name: string;
  /** Unit price in cents, read from the database (never from the client). */
  unitAmountCents: number;
  quantity: number;
};

export type CheckoutSessionInput = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  lines: CheckoutLine[];
  shippingCents: number;
  /** Absolute URLs. */
  successUrl: string;
  cancelUrl: string;
  /** When the stock reservation ends. */
  reservedUntil: Date;
};

export type CheckoutSession = {
  sessionId: string;
  /** Where to send the shopper: Stripe's hosted page or the internal /mock-pay page. */
  redirectUrl: string;
};

export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  /** Best-effort: stop a session that should no longer be paid (e.g. after cancel). */
  cancelSession(sessionId: string): Promise<void>;
}
