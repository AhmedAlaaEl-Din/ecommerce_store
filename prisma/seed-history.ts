/**
 * DEMO HISTORY: about 60 invented orders spread over the last 45 days, so the
 * admin dashboard has something to show. Every customer is invented
 * ("… Example", @example.com) and every order carries a timeline entry saying it
 * is demo history. Re-running replaces the previous demo history.
 *
 * These orders are history only: they do not change current stock (their stock
 * was "sold" before the opening balance), so the stock history still adds up.
 *
 *   npm run db:seed:history
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { cartTotals, lineTotalCents } from "../src/lib/cart/math";
import { createDb } from "../src/lib/db";
import { formatOrderNumber } from "../src/lib/orders/service";

/** History customers are "<name>.history<NN>@example.com". */
export const HISTORY_EMAIL_FILTER = { contains: ".history", endsWith: "@example.com" };
const DAY = 86_400_000;

const FIRST = [
  "Nadia",
  "Omar",
  "Layla",
  "Karim",
  "Salma",
  "Yusuf",
  "Hana",
  "Tarek",
  "Mariam",
  "Ziad",
  "Farah",
  "Adam",
  "Noor",
  "Samir",
  "Dina",
  "Hassan",
  "Rania",
  "Malik",
  "Yara",
  "Idris",
];
const STREETS = [
  "Papyrus Road",
  "Lotus Lane",
  "Reed Street",
  "Delta Avenue",
  "Sycamore Walk",
  "Granary Row",
];
const PLACES: Array<{ country: string; city: string; postal: string }> = [
  { country: "EG", city: "Delta Town", postal: "11511" },
  { country: "AE", city: "Palm Bay", postal: "00000" },
  { country: "SA", city: "Oasis City", postal: "12271" },
  { country: "GB", city: "Riverford", postal: "RF1 2AB" },
  { country: "DE", city: "Lindenau", postal: "04177" },
  { country: "FR", city: "Saint-Exemple", postal: "75011" },
  { country: "US", city: "Springfield", postal: "62704" },
  { country: "CA", city: "Lakeside", postal: "K1A 0B1" },
];

/** Small deterministic PRNG so the history looks the same on every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedHistory(db: PrismaClient, opts: { now?: Date; count?: number } = {}) {
  const now = opts.now ?? new Date();
  const count = opts.count ?? 60;
  const rand = mulberry32(20261121);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;

  // Replace any previous demo history.
  const removed = await db.$transaction(async (tx) => {
    const old = await tx.order.findMany({
      where: { email: HISTORY_EMAIL_FILTER },
      select: { id: true },
    });
    const ids = old.map((o) => o.id);
    await tx.stockMovement.deleteMany({ where: { orderId: { in: ids } } });
    await tx.order.deleteMany({ where: { id: { in: ids } } });
    return ids.length;
  });

  const products = await db.product.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, priceCents: true, currency: true },
    orderBy: { slug: "asc" },
  });
  if (products.length === 0) throw new Error("Seed the catalog first (npm run db:seed).");

  let created = 0;
  for (let i = 0; i < count; i++) {
    // Spread over 45 days, a little denser recently.
    const ageDays = Math.floor(Math.pow(rand(), 1.3) * 45);
    const createdAt = new Date(
      now.getTime() - ageDays * DAY - Math.floor(rand() * 20) * 3_600_000 - 600_000,
    );
    const first = pick(FIRST);
    const place = pick(PLACES);
    const lineCount = 1 + Math.floor(rand() * 3);
    const chosen = new Map<string, (typeof products)[number] & { quantity: number }>();
    while (chosen.size < lineCount) {
      const p = pick(products);
      chosen.set(p.id, { ...p, quantity: 1 + Math.floor(rand() * 2) });
    }
    const lines = [...chosen.values()];
    const totals = cartTotals(lines);

    // ~12% cancelled (never paid); the rest paid, fulfilled according to age.
    const cancelled = rand() < 0.12;
    const paidAt = cancelled ? null : new Date(createdAt.getTime() + 90_000);
    let fulfilment: "unfulfilled" | "packed" | "shipped" | "delivered" = "unfulfilled";
    if (!cancelled) {
      if (ageDays >= 8) fulfilment = "delivered";
      else if (ageDays >= 3) fulfilment = rand() < 0.7 ? "shipped" : "delivered";
      else if (ageDays >= 1) fulfilment = rand() < 0.5 ? "packed" : "shipped";
      else fulfilment = rand() < 0.6 ? "unfulfilled" : "packed";
    }
    const at = (hours: number) => (paidAt ? new Date(paidAt.getTime() + hours * 3_600_000) : null);
    const packedAt = ["packed", "shipped", "delivered"].includes(fulfilment) ? at(5) : null;
    const shippedAt = ["shipped", "delivered"].includes(fulfilment) ? at(20) : null;
    const deliveredAt = fulfilment === "delivered" ? at(70) : null;
    const carrier = shippedAt
      ? pick(["Nile Post (demo)", "Delta Express (demo)", "Oasis Freight (demo)"])
      : null;
    const trackingNumber = shippedAt ? `DEMO${String(100000 + Math.floor(rand() * 899999))}` : null;

    await db.$transaction(async (tx) => {
      const year = createdAt.getUTCFullYear();
      const counter = await tx.orderCounter.upsert({
        where: { year },
        create: { year, value: 1 },
        update: { value: { increment: 1 } },
      });
      const order = await tx.order.create({
        data: {
          publicToken: randomBytes(24).toString("base64url"),
          orderNumber: formatOrderNumber(year, counter.value),
          status: cancelled ? "cancelled" : "paid",
          email: `${first.toLowerCase()}.history${String(i + 1).padStart(2, "0")}@example.com`,
          customerName: `${first} Example`,
          addressLine1: `${1 + Math.floor(rand() * 98)} ${pick(STREETS)}`,
          city: place.city,
          postalCode: place.postal,
          country: place.country,
          subtotalCents: totals.subtotalCents,
          shippingCents: totals.shippingCents,
          totalCents: totals.totalCents,
          currency: "USD",
          provider: "mock",
          providerSessionId: "mock_cs_history_" + randomBytes(12).toString("base64url"),
          reservedUntil: new Date(createdAt.getTime() + 30 * 60_000),
          paidAt,
          fulfilmentStatus: fulfilment,
          packedAt,
          shippedAt,
          deliveredAt,
          carrier,
          trackingNumber,
          createdAt,
          items: {
            create: lines.map((l) => ({
              productId: l.id,
              productNameSnapshot: l.name,
              unitPriceCentsSnapshot: l.priceCents,
              quantity: l.quantity,
              lineTotalCents: lineTotalCents({ priceCents: l.priceCents, quantity: l.quantity }),
            })),
          },
        },
      });
      const events: Array<{ type: string; message: string; createdAt: Date }> = [
        {
          type: "created",
          message: "Demo history order (invented; npm run db:seed:history)",
          createdAt,
        },
      ];
      if (cancelled) {
        events.push({
          type: "cancelled",
          message: "Order cancelled; reserved stock released",
          createdAt: new Date(createdAt.getTime() + 20 * 60_000),
        });
      } else {
        events.push({ type: "paid", message: "Payment received", createdAt: paidAt! });
        if (packedAt)
          events.push({ type: "packed", message: "Marked as packed", createdAt: packedAt });
        if (shippedAt)
          events.push({
            type: "shipped",
            message: `Marked as shipped with ${carrier} (${trackingNumber})`,
            createdAt: shippedAt,
          });
        if (deliveredAt)
          events.push({
            type: "delivered",
            message: "Marked as delivered",
            createdAt: deliveredAt,
          });
      }
      await tx.orderEvent.createMany({ data: events.map((e) => ({ ...e, orderId: order.id })) });
    });
    created++;
  }
  return { removed, created };
}

async function main() {
  const db = createDb();
  try {
    const { removed, created } = await seedHistory(db);
    console.log(
      `Demo history: created ${created} invented orders over the last 45 days${removed ? ` (replaced ${removed})` : ""}.`,
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && /seed-history\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
