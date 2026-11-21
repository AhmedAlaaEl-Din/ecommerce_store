import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "../db";

export const PRODUCT_SORTS = ["name", "priceCents", "stock", "createdAt"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const PRODUCT_STATES = ["active", "inactive", "archived", "all"] as const;
export type ProductState = (typeof PRODUCT_STATES)[number];
export const PRODUCT_PAGE_SIZE = 20;

export type ProductFilters = {
  q?: string;
  categoryId?: string;
  state?: ProductState;
  low?: boolean;
  sort?: ProductSort;
  dir?: "asc" | "desc";
  page?: number;
};

export function productWhere(f: ProductFilters, threshold: number): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const state = f.state ?? "active";
  if (state === "active") Object.assign(where, { archivedAt: null, isActive: true });
  if (state === "inactive") Object.assign(where, { archivedAt: null, isActive: false });
  if (state === "archived") where.archivedAt = { not: null };
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.low) where.stock = { lte: threshold };
  const q = f.q?.trim().slice(0, 80);
  if (q) where.OR = [{ name: { contains: q } }, { slug: { contains: q.toLowerCase() } }];
  return where;
}

export async function listAdminProducts(db: Db, f: ProductFilters, threshold: number) {
  const where = productWhere(f, threshold);
  const sort = f.sort ?? "name";
  const dir = f.dir ?? (sort === "createdAt" ? "desc" : "asc");
  const page = Math.max(1, f.page ?? 1);
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ [sort]: dir }, { id: "asc" }],
      skip: (page - 1) * PRODUCT_PAGE_SIZE,
      take: PRODUCT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        compareAtCents: true,
        currency: true,
        stock: true,
        isActive: true,
        isFeatured: true,
        archivedAt: true,
        createdAt: true,
        imagePath: true,
        thumbPath: true,
        category: { select: { name: true, accentColor: true } },
        _count: { select: { orderItems: true } },
      },
    }),
  ]);
  return { total, rows, page, sort, dir, pageCount: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)) };
}
