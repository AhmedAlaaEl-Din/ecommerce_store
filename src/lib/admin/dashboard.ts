/**
 * Dashboard numbers. Days are UTC days. Revenue counts orders that are paid now
 * (refunded orders drop out), dated by when they were paid.
 */
import type { Db } from "../db";
import { getLowStockThreshold } from "../inventory/stock";

const DAY = 86_400_000;

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type DayRevenue = { day: string; revenueCents: number; orders: number };

/** Buckets paid orders into the last `days` UTC days (oldest first, zero-filled). */
export function revenueByDay(
  orders: ReadonlyArray<{ paidAt: Date; totalCents: number }>,
  now: Date,
  days = 30,
): DayRevenue[] {
  const today = startOfUtcDay(now).getTime();
  const out: DayRevenue[] = [];
  const index = new Map<string, DayRevenue>();
  for (let i = days - 1; i >= 0; i--) {
    const row = { day: isoDay(new Date(today - i * DAY)), revenueCents: 0, orders: 0 };
    out.push(row);
    index.set(row.day, row);
  }
  for (const o of orders) {
    const row = index.get(isoDay(o.paidAt));
    if (row) {
      row.revenueCents += o.totalCents;
      row.orders += 1;
    }
  }
  return out;
}

export async function getDashboard(db: Db, now = new Date()) {
  const today = startOfUtcDay(now);
  const since30 = new Date(today.getTime() - 29 * DAY);
  const since7 = new Date(today.getTime() - 6 * DAY);
  const threshold = await getLowStockThreshold(db);

  const [paid30, pendingCount, lowStock, recentOrders, currencyRow] = await Promise.all([
    db.order.findMany({
      where: { status: "paid", paidAt: { gte: since30 } },
      select: { paidAt: true, totalCents: true },
    }),
    db.order.count({ where: { status: "pending_payment" } }),
    db.product.findMany({
      where: { archivedAt: null, stock: { lte: threshold } },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      select: { id: true, name: true, stock: true, isActive: true, category: { select: { name: true } } },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        createdAt: true,
        status: true,
        fulfilmentStatus: true,
        totalCents: true,
        currency: true,
      },
    }),
    db.order.findFirst({ select: { currency: true } }),
  ]);

  const sum = (from: Date) =>
    paid30
      .filter((o) => o.paidAt && o.paidAt >= from)
      .reduce((acc, o) => ({ revenue: acc.revenue + o.totalCents, orders: acc.orders + 1 }), {
        revenue: 0,
        orders: 0,
      });
  const t = sum(today);
  const w = sum(since7);
  const m = sum(since30);
  const days = revenueByDay(
    paid30.map((o) => ({ paidAt: o.paidAt!, totalCents: o.totalCents })),
    now,
    30,
  );
  return {
    currency: currencyRow?.currency ?? "USD",
    threshold,
    kpis: {
      today: t,
      last7: w,
      last30: m,
      averageOrderCents: m.orders ? Math.round(m.revenue / m.orders) : 0,
      pendingCount,
      lowStockCount: lowStock.length,
    },
    days,
    lowStock: lowStock.slice(0, 8),
    recentOrders,
  };
}
