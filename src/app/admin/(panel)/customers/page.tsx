import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyRow,
  PageHeader,
  ResultCount,
  smallField,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDate, hrefWith, pageParam, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { CUSTOMER_PAGE_SIZE, listCustomers } from "@/lib/admin/customers";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { countryName } from "@/lib/orders/checkout-schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const q = param(sp, "q");
  const list = await listCustomers(db, q, pageParam(param(sp, "page")));
  return (
    <>
      <PageHeader
        title="Customers"
        description="Read-only, built from orders (the store has no customer accounts). Spent counts paid orders."
      />
      <form method="get" className="mb-3 flex items-end gap-2" role="search" aria-label="Search customers">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Search
          <input type="search" name="q" defaultValue={q} placeholder="Email or name" className={`${smallField} w-64`} />
        </label>
        <button type="submit" className="bg-ink hover:bg-ink/85 h-10 rounded-sm px-4 text-sm font-medium text-white">
          Search
        </button>
      </form>
      <div className="mb-2">
        <ResultCount page={list.page} pageSize={CUSTOMER_PAGE_SIZE} total={list.total} noun="customers" />
      </div>
      <TableWrap label="Customers">
        <thead>
          <tr>
            <th scope="col" className={thClass}>Customer</th>
            <th scope="col" className={thClass}>Country</th>
            <th scope="col" className={`${thClass} text-right`}>Orders</th>
            <th scope="col" className={`${thClass} text-right`}>Paid</th>
            <th scope="col" className={`${thClass} text-right`}>Spent</th>
            <th scope="col" className={thClass}>Last order</th>
          </tr>
        </thead>
        <tbody>
          {list.rows.length === 0 && <EmptyRow colSpan={6} title={q ? "No customers match" : "No customers yet"} />}
          {list.rows.map((c) => (
            <tr key={c.email} className="hover:bg-sunken/40" data-testid="customer-row">
              <td className={tdClass}>
                <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="font-medium underline-offset-2 hover:underline">
                  {c.name}
                </Link>
                <div className="text-muted text-xs">{c.email}</div>
              </td>
              <td className={tdClass}>{countryName(c.country)}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{c.orders}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{c.paidOrders}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(c.spentCents, "USD")}</td>
              <td className={`${tdClass} text-muted`}>{fmtDate(c.lastOrderAt)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-4">
        <Pagination page={list.page} totalPages={list.pageCount} hrefFor={(n) => hrefWith("/admin/customers", { q }, { page: String(n) })} />
      </div>
    </>
  );
}
