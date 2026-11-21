/** Customers are derived from orders (there are no customer accounts). Read-only. */
import type { Db } from "../db";

export const CUSTOMER_PAGE_SIZE = 25;

export async function listCustomers(db: Db, q: string | undefined, page: number) {
  const term = q?.trim().slice(0, 80);
  const where = term
    ? { OR: [{ email: { contains: term.toLowerCase() } }, { customerName: { contains: term } }] }
    : {};
  const groups = await db.order.groupBy({
    by: ["email"],
    where,
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const paid = await db.order.groupBy({
    by: ["email"],
    where: { ...where, status: "paid" },
    _count: { _all: true },
    _sum: { totalCents: true },
  });
  const paidBy = new Map(paid.map((p) => [p.email, p]));
  const rows = groups
    .map((g) => ({
      email: g.email,
      orders: g._count._all,
      paidOrders: paidBy.get(g.email)?._count._all ?? 0,
      spentCents: paidBy.get(g.email)?._sum.totalCents ?? 0,
      lastOrderAt: g._max.createdAt,
    }))
    .sort((a, b) => (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0));
  const total = rows.length;
  const slice = rows.slice((page - 1) * CUSTOMER_PAGE_SIZE, page * CUSTOMER_PAGE_SIZE);
  // Latest name used with each email on this page.
  const latest = await db.order.findMany({
    where: { email: { in: slice.map((r) => r.email) } },
    orderBy: { createdAt: "desc" },
    distinct: ["email"],
    select: { email: true, customerName: true, country: true },
  });
  const nameBy = new Map(latest.map((l) => [l.email, l]));
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)),
    rows: slice.map((r) => ({
      ...r,
      name: nameBy.get(r.email)?.customerName ?? "",
      country: nameBy.get(r.email)?.country ?? "",
    })),
  };
}
