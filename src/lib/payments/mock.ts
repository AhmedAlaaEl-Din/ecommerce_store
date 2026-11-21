/**
 * Mock payment provider for offline development, tests and demo recordings.
 * Sessions are just random ids; the shopper is sent to /mock-pay/[sessionId],
 * whose buttons post signed events through the same webhook handler as Stripe.
 */
import { randomBytes } from "node:crypto";
import type { CheckoutSession, CheckoutSessionInput, PaymentProvider } from "./types";

export const MOCK_SESSION_PREFIX = "mock_cs_";
export const MOCK_SESSION_ID_RE = /^mock_cs_[A-Za-z0-9_-]{20,64}$/;

export function newMockSessionId(): string {
  return MOCK_SESSION_PREFIX + randomBytes(18).toString("base64url");
}

export function newMockEventId(): string {
  return "evt_mock_" + randomBytes(18).toString("base64url");
}

export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    void input; // the mock page reads the order (and its server-side totals) from the database
    const sessionId = newMockSessionId();
    return { sessionId, redirectUrl: `/mock-pay/${sessionId}` };
  }

  async cancelSession(): Promise<void> {
    // Nothing to do: a mock session cannot be paid once its order is no longer pending.
  }
}
