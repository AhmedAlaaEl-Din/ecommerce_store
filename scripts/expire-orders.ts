/**
 * Releases stock held by pending orders whose 30-minute reservation has passed
 * (status -> expired). The same logic also runs before every checkout attempt.
 * Run: npm run orders:expire   (a cron job would run this every few minutes in Phase 4)
 */
import "dotenv/config";
import { createDb } from "../src/lib/db";
import { expireStaleOrders } from "../src/lib/orders/service";

async function main() {
  const db = createDb();
  try {
    const count = await expireStaleOrders(db);
    console.log(`Expired ${count} pending order(s) and released their stock.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
