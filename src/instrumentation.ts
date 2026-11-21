/**
 * Runs once when the server starts. Validates the payment configuration so a
 * bad setup (e.g. PAYMENT_PROVIDER=stripe without keys, or the mock provider in
 * production without ALLOW_MOCK_PAYMENTS) stops the server immediately with a
 * clear message instead of failing on the first checkout.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // checked at `next start`
  const { getPaymentConfig } = await import("./lib/payments/config");
  const config = getPaymentConfig();
  console.log(`[payments] provider: ${config.provider}`);
}
