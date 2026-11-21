import "server-only";
import { getPaymentConfig, type PaymentConfig } from "./config";
import { MockProvider } from "./mock";
import { StripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export function createProvider(config: PaymentConfig): PaymentProvider {
  return config.provider === "stripe"
    ? new StripeProvider(config.stripeSecretKey)
    : new MockProvider();
}

let cached: { config: PaymentConfig; provider: PaymentProvider } | null = null;

/** The configured provider (throws PaymentConfigError on a bad configuration). */
export function getPayments(): { config: PaymentConfig; provider: PaymentProvider } {
  if (!cached) {
    const config = getPaymentConfig();
    cached = { config, provider: createProvider(config) };
  }
  return cached;
}

export type { PaymentProvider } from "./types";
