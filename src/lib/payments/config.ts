/**
 * Payment provider selection. Pure function of the environment so the rules
 * can be unit-tested; `instrumentation.ts` calls it at startup so a bad
 * configuration fails fast instead of on the first checkout.
 *
 * Rules:
 * - PAYMENT_PROVIDER = "mock" (default) | "stripe". Anything else is an error.
 * - stripe: STRIPE_SECRET_KEY must be a TEST key (sk_test_…) and
 *   STRIPE_WEBHOOK_SECRET must be set (whsec_…). Live keys are refused.
 * - mock: disabled when NODE_ENV=production unless ALLOW_MOCK_PAYMENTS=true.
 *   Signs its events with MOCK_WEBHOOK_SECRET; outside production a dev-only
 *   default is used when it is not set.
 */
import { randomBytes } from "node:crypto";

export type ProviderName = "mock" | "stripe";

export type PaymentConfig =
  | { provider: "mock"; webhookSecret: string; mockEnabled: true }
  | {
      provider: "stripe";
      webhookSecret: string;
      stripeSecretKey: string;
      mockEnabled: false;
    };

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

/**
 * Dev-only signing secret for mock events when MOCK_WEBHOOK_SECRET is not set:
 * random per server process, so nobody can forge mock events from a known value.
 * (Signing and verifying both happen inside the same process.)
 */
export const DEV_MOCK_WEBHOOK_SECRET = randomBytes(32).toString("hex");

type Env = Record<string, string | undefined>;

export function isMockAllowed(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" || env.ALLOW_MOCK_PAYMENTS === "true";
}

export function getPaymentConfig(env: Env = process.env): PaymentConfig {
  const raw = (env.PAYMENT_PROVIDER ?? "").trim().toLowerCase();
  const provider = raw === "" ? "mock" : raw;

  if (provider === "stripe") {
    const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
    const secret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
    if (!key || !secret) {
      throw new PaymentConfigError(
        "PAYMENT_PROVIDER=stripe needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. " +
          'Set them in .env (test keys only), or use PAYMENT_PROVIDER="mock".',
      );
    }
    if (!key.startsWith("sk_test_")) {
      throw new PaymentConfigError(
        "STRIPE_SECRET_KEY must be a Stripe TEST key (starting with sk_test_). Live keys are refused.",
      );
    }
    return { provider: "stripe", stripeSecretKey: key, webhookSecret: secret, mockEnabled: false };
  }

  if (provider === "mock") {
    if (!isMockAllowed(env)) {
      throw new PaymentConfigError(
        "The mock payment provider is disabled in production. Set PAYMENT_PROVIDER=stripe, " +
          'or ALLOW_MOCK_PAYMENTS="true" for a local demo.',
      );
    }
    const configured = env.MOCK_WEBHOOK_SECRET?.trim() ?? "";
    if (!configured && env.NODE_ENV === "production") {
      throw new PaymentConfigError(
        "MOCK_WEBHOOK_SECRET must be set when mock payments are allowed in production.",
      );
    }
    return {
      provider: "mock",
      webhookSecret: configured || DEV_MOCK_WEBHOOK_SECRET,
      mockEnabled: true,
    };
  }

  throw new PaymentConfigError(`Unknown PAYMENT_PROVIDER "${raw}". Use "mock" or "stripe".`);
}
