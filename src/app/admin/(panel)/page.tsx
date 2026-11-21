import type { Metadata } from "next";
import Link from "next/link";
import { RevenueChart } from "@/components/admin/RevenueChart";
import {
  EmptyRow,
  FulfilmentBadge,
  Kpi,
  PageHeader,
  Panel,
  PaymentBadge,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { getDashboard } from "@/lib/admin/dashboard";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();
  const d = await getDashboard(db);
  const money = (c: number) => formatMoney(c, d.currency);
  const orders = (n: number) => `${n} paid order${n === 1 ? "" : "s"}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name.split(" ")[0]}. Figures use UTC days and count paid orders.`}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="kpis">
        <Kpi
          label="Revenue today"
          value={money(d.kpis.today.revenue)}
          sub={orders(d.kpis.today.orders)}
          testId="kpi-today"
        />
        <Kpi
          label="Last 7 days"
          value={money(d.kpis.last7.revenue)}
          sub={orders(d.kpis.last7.orders)}
          testId="kpi-7d"
        />
        <Kpi
          label="Last 30 days"
          value={money(d.kpis.last30.revenue)}
          sub={orders(d.kpis.last30.orders)}
          testId="kpi-30d"
        />
        <Kpi
          label="Average order"
          value={money(d.kpis.averageOrderCents)}
          sub="Last 30 days"
          testId="kpi-aov"
        />
        <Kpi
          label="Pending payment"
          value={d.kpis.pendingCount}
          sub={
            <Link
              href="/admin/orders?status=pending_payment"
              className="text-primary underline underline-offset-2"
            >
              View orders
            </Link>
          }
          testId="kpi-pending"
        />
        <Kpi
          label="Low stock"
          value={d.kpis.lowStockCount}
          sub={
            <Link
              href="/admin/inventory?low=1"
              className="text-primary underline underline-offset-2"
            >
              {`At or below ${d.threshold}`}
            </Link>
          }
          testId="kpi-low"
        />
      </div>

      <Panel title="Revenue by day" className="mt-4" id="revenue">
        <RevenueChart days={d.days} currency={d.currency} />
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Panel
          title="Recent orders"
          id="recent-orders"
          padded={false}
          actions={
            <Link
              href="/admin/orders"
              className="text-primary text-sm font-medium underline underline-offset-2"
            >
              All orders
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Order
                  </th>
                  <th scope="col" className={thClass}>
                    Customer
                  </th>
                  <th scope="col" className={thClass}>
                    Payment
                  </th>
                  <th scope="col" className={thClass}>
                    Fulfilment
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.recentOrders.length === 0 && <EmptyRow colSpan={5} title="No orders yet" />}
                {d.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-sunken/40">
                    <td className={tdClass}>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-primary font-medium underline-offset-2 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                      <div className="text-muted text-xs">{fmtDateTime(o.createdAt)}</div>
                    </td>
                    <td className={tdClass}>{o.customerName}</td>
                    <td className={tdClass}>
                      <PaymentBadge status={o.status} />
                    </td>
                    <td className={tdClass}>
                      <FulfilmentBadge status={o.fulfilmentStatus} muted={o.status !== "paid"} />
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatMoney(o.totalCents, o.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Low stock"
          id="low-stock"
          padded={false}
          actions={
            <Link
              href="/admin/inventory?low=1"
              className="text-primary text-sm font-medium underline underline-offset-2"
            >
              Inventory
            </Link>
          }
        >
          {d.lowStock.length === 0 ? (
            <p className="text-muted p-4 text-sm" data-testid="empty-state">
              Nothing is at or below {d.threshold}.
            </p>
          ) : (
            <ul className="divide-line divide-y" data-testid="low-stock-list">
              {d.lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <Link
                      href={`/admin/inventory/${p.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-muted block text-xs">{p.category.name}</span>
                  </span>
                  <span
                    className={
                      p.stock === 0
                        ? "bg-danger-soft text-danger rounded-sm px-2 py-0.5 text-xs font-semibold tabular-nums"
                        : "bg-warning-soft text-warning rounded-sm px-2 py-0.5 text-xs font-semibold tabular-nums"
                    }
                  >
                    {p.stock === 0 ? "Out" : `${p.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
