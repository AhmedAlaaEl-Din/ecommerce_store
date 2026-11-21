/** Inventory reads and the low-stock setting. */
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "../db";
import { DEFAULT_LOW_STOCK, getLowStockThreshold, LOW_STOCK_KEY } from "../inventory/stock";
import { assertCan, fail, type Actor } from "./actor";
import { writeAudit } from "./audit";

export { getLowStockThreshold, DEFAULT_LOW_STOCK };

export async function setLowStockThreshold(db: Db, actor: Actor, value: number) {
  assertCan(actor, "inventory.settings");
  if (!Number.isInteger(value) || value < 0 || value > 1000) {
    return fail("Enter a whole number from 0 to 1,000.");
  }
  return db.$transaction(async (tx) => {
    const before = await getLowStockThreshold(tx);
    await tx.setting.upsert({
      where: { key: LOW_STOCK_KEY },
      create: { key: LOW_STOCK_KEY, value: String(value) },
      update: { value: String(value) },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "settings.low_stock",
      entityType: "Setting",
      entityId: LOW_STOCK_KEY,
      summary: { threshold: [before, value] },
    });
    return { ok: true as const };
  });
}

export type InventoryFilters = { q?: string; low?: boolean; categoryId?: string };

export async function listInventory(db: Db, f: InventoryFilters, threshold: number) {
  const where: Prisma.ProductWhereInput = { archivedAt: null };
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.low) where.stock = { lte: threshold };
  const q = f.q?.trim().slice(0, 80);
  if (q) where.OR = [{ name: { contains: q } }, { slug: { contains: q.toLowerCase() } }];
  return db.product.findMany({
    where,
    orderBy: [{ stock: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      stock: true,
      isActive: true,
      category: { select: { name: true } },
    },
  });
}

export const MOVEMENTS_PAGE_SIZE = 25;

export async function productMovements(db: Db, productId: string, page = 1) {
  const [total, rows, sum] = await Promise.all([
    db.stockMovement.count({ where: { productId } }),
    db.stockMovement.findMany({
      where: { productId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * MOVEMENTS_PAGE_SIZE,
      take: MOVEMENTS_PAGE_SIZE,
      include: {
        actor: { select: { name: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    }),
    db.stockMovement.aggregate({ where: { productId }, _sum: { delta: true } }),
  ]);
  return {
    total,
    rows,
    page,
    pageCount: Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE)),
    sumOfMovements: sum._sum.delta ?? 0,
  };
}
