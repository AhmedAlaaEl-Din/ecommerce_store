import type { Prisma } from "@/generated/prisma/client";
import { db as defaultDb, type Db } from "./db";
import { PAGE_SIZE, type CatalogQuery } from "./schemas";

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  priceCents: true,
  compareAtCents: true,
  currency: true,
  stock: true,
  imagePath: true,
  category: { select: { slug: true, name: true, accentColor: true } },
} satisfies Prisma.ProductSelect;

export type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export async function getCategories(db: Db = defaultDb) {
  return db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, description: true, accentColor: true },
  });
}

export async function getCategoriesWithCounts(db: Db = defaultDb) {
  const rows = await db.category.findMany({
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      description: true,
      accentColor: true,
      products: {
        where: { isActive: true },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        select: { imagePath: true, name: true },
      },
    },
  });
  return rows.map(({ products, ...c }) => ({
    ...c,
    productCount: products.length,
    coverImage: products[0]?.imagePath ?? null,
    coverName: products[0]?.name ?? c.name,
  }));
}

export async function getFeaturedProducts(limit = 4, db: Db = defaultDb) {
  return db.product.findMany({
    where: { isActive: true, isFeatured: true, stock: { gt: 0 }, compareAtCents: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: productCardSelect,
  });
}

export async function getSaleProducts(limit = 4, db: Db = defaultDb) {
  // SQLite and Postgres both support comparing two columns, but Prisma's
  // filter API cannot express compareAtCents > priceCents, so we filter in JS
  // over the (small) set of products with a compare-at price.
  const rows = await db.product.findMany({
    where: { isActive: true, compareAtCents: { not: null } },
    orderBy: { createdAt: "desc" },
    select: productCardSelect,
  });
  return rows.filter((p) => p.compareAtCents != null && p.compareAtCents > p.priceCents).slice(0, limit);
}

const sortOrder: Record<CatalogQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { name: "asc" }],
  "price-asc": [{ priceCents: "asc" }, { name: "asc" }],
  "price-desc": [{ priceCents: "desc" }, { name: "asc" }],
};

export async function searchProducts(query: CatalogQuery, db: Db = defaultDb) {
  const where: Prisma.ProductWhereInput = { isActive: true };
  if (query.category) where.category = { slug: query.category };
  if (query.q) where.name = { contains: query.q };

  const total = await db.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const products = await db.product.findMany({
    where,
    orderBy: sortOrder[query.sort],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: productCardSelect,
  });
  return { products, total, page, totalPages };
}

export async function getCategoryBySlug(slug: string, db: Db = defaultDb) {
  return db.category.findUnique({ where: { slug } });
}

/** Active product by slug, or null. Inactive products are treated as not found. */
export async function getProductBySlug(slug: string, db: Db = defaultDb) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const product = await db.product.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!product || !product.isActive) return null;
  return product;
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4,
  db: Db = defaultDb,
) {
  return db.product.findMany({
    where: { isActive: true, categoryId, id: { not: productId } },
    orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: productCardSelect,
  });
}
