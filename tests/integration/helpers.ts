import { createDb } from "@/lib/db";

export const TEST_DB_URL = "file:./prisma/test.db";

export function testDb() {
  if (!process.env.DATABASE_URL?.includes("test.db")) {
    throw new Error("Integration tests must run against prisma/test.db");
  }
  return createDb(TEST_DB_URL);
}

export async function resetDb(db: ReturnType<typeof createDb>) {
  // Phase 3 tables first (they reference orders, products and admin users).
  await db.refund.deleteMany();
  await db.orderNote.deleteMany();
  await db.orderEvent.deleteMany();
  await db.stockMovement.deleteMany();
  await db.auditLog.deleteMany();
  await db.adminSession.deleteMany();
  await db.adminUser.deleteMany();
  await db.setting.deleteMany();
  await db.processedEvent.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.orderCounter.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
}

export async function makeFixtures(db: ReturnType<typeof createDb>) {
  const category = await db.category.create({
    data: { slug: "test-cat", name: "Test", description: "Test category", accentColor: "#EEEEEE" },
  });
  const base = {
    shortDescription: "Test product",
    description: "A product used in tests.",
    currency: "USD",
    imagePath: "/products/dune-ceramic-vase.svg",
    categoryId: category.id,
  };
  const plenty = await db.product.create({
    data: { ...base, slug: "plenty", name: "Plenty", priceCents: 1250, stock: 10 },
  });
  const scarce = await db.product.create({
    data: {
      ...base,
      slug: "scarce",
      name: "Scarce",
      priceCents: 4000,
      compareAtCents: 5000,
      stock: 2,
    },
  });
  const soldOut = await db.product.create({
    data: { ...base, slug: "sold-out", name: "Sold out", priceCents: 999, stock: 0 },
  });
  const inactive = await db.product.create({
    data: {
      ...base,
      slug: "inactive",
      name: "Inactive",
      priceCents: 700,
      stock: 5,
      isActive: false,
    },
  });
  return { category, plenty, scarce, soldOut, inactive };
}
