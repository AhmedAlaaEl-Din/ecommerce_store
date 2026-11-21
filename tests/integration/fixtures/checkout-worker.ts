/**
 * Runs ONE checkout in its own process (own SQLite connection), started at a
 * shared moment, so the integration test can race two real processes.
 * Usage: tsx checkout-worker.ts <cartId> <startAtEpochMs> <email>
 */
import { createDb } from "@/lib/db";
import { createPendingOrder } from "@/lib/orders/service";

const [cartId, startAt, email] = process.argv.slice(2);

async function main() {
  const db = createDb("file:./prisma/test.db");
  await db.$queryRawUnsafe("SELECT 1"); // connect before the start line
  while (Date.now() < Number(startAt)) await new Promise((r) => setTimeout(r, 1));
  const r = await createPendingOrder(db, {
    cartId: cartId!,
    provider: "mock",
    customer: {
      email: email!,
      name: "Race Example",
      addressLine1: "1 Test Street",
      addressLine2: "",
      city: "Delta Town",
      postalCode: "DT 1000",
      country: "nilera",
    },
  });
  process.stdout.write(JSON.stringify(r.ok ? { ok: true } : { ok: false, code: r.code }));
  await db.$disconnect();
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({ ok: false, code: "ERROR", message: String(err).slice(0, 300) }),
  );
  process.exitCode = 1;
});
