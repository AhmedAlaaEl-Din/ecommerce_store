import "dotenv/config";
import type { PrismaClient } from "../src/generated/prisma/client";
import { createDb } from "../src/lib/db";
import { categories, products, SEED_EPOCH } from "./seed-data";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Idempotent seed: upserts categories and products by slug, so running it
 * again restores the demo catalog without creating duplicates.
 * Pass { resetCarts: true } to also clear every cart (used for demo frames).
 */
export async function seedDatabase(db: PrismaClient, opts: { resetCarts?: boolean } = {}) {
  if (opts.resetCarts) {
    await db.cartItem.deleteMany();
    await db.cart.deleteMany();
  }

  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, accentColor: c.accentColor },
    });
    categoryIds.set(c.slug, row.id);
  }

  for (const p of products) {
    const categoryId = categoryIds.get(p.category);
    if (!categoryId) throw new Error(`Unknown category ${p.category} for ${p.slug}`);
    const data = {
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      priceCents: p.priceCents,
      compareAtCents: p.compareAtCents ?? null,
      currency: "USD",
      stock: p.stock,
      imagePath: `/products/${p.slug}.svg`,
      categoryId,
      isActive: true,
      isFeatured: p.isFeatured ?? false,
      createdAt: new Date(SEED_EPOCH.getTime() - p.ageDays * DAY),
    };
    await db.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });
  }

  return { categories: categories.length, products: products.length };
}

async function main() {
  const db = createDb();
  try {
    const resetCarts = process.argv.includes("--reset-carts");
    const result = await seedDatabase(db, { resetCarts });
    console.log(
      `Seeded ${result.categories} categories and ${result.products} products${resetCarts ? " (carts cleared)" : ""}.`,
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
