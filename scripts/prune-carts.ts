/**
 * Deletes carts idle for more than 30 days (the cookie lifetime).
 * Run: npm run db:prune-carts   (a cron job would run this in Phase 4)
 */
import "dotenv/config";
import { pruneIdleCarts } from "../src/lib/cart/service";
import { createDb } from "../src/lib/db";

async function main() {
  const db = createDb();
  try {
    const count = await pruneIdleCarts(db, 30);
    console.log(`Pruned ${count} idle cart(s).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
