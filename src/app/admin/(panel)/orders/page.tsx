import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyRow,
  FulfilmentBadge,
  PageHeader,
  PaymentBadge,
  ResultCount,
  smallField,
  SortTh,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { DownloadIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDateTime, hrefWith, oneOf, pageParam, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { FULFILMENT_LABELS, FULFILMENT_STEPS, PAYMENT_LABELS } from "@/lib/admin/order-rules";
import { listOrders, ORDER_PAGE_SIZE, ORDER_SORTS } from "@/lib/admin/orders";
import { can } from "@/lib/admin/roles";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };

const PAYMENT = [
  "pending_payment",
  "paid",
  "payment_failed",
  "cancelled",
  "expired",
  "refunded",
] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { user } = await requireAdmin();
  const sp = await searchParams;
  const from = param(sp, "from");
  const to = param(sp, "to");
  const params = {
    q: param(sp, "q"),
    status: oneOf(param(sp, "status"), PAYMENT),
    fulfilment: oneOf(param(sp, "fulfilment"), FULFILMENT_STEPS),
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    sort: oneOf(param(sp, "sort"), ORDER_SORTS),
    dir: oneOf(param(sp, "dir"), ["asc", "desc"] as const),
    page: param(sp, "page"),
  };
  const list = await listOrders(db, { ...params, page: pageParam(params.page) });
  const path = "/admin/orders";
  const sort = params.sort ?? "createdAt";
  const dir = params.dir ?? "desc";
  const filtered = !!(params.q || params.status || params.fulfilment || params.from || params.to);

  return (
    <>
      <PageHeader
        title="Orders"
        description="Filter by payment, fulfilment and date (UTC). Search by order number, email or name."
        actions={
          can(user.role, "orders.export") && (
            <ButtonLink
              href={hrefWith(`${path}/export`, { ...params, page: undefined, dir: undefined })}
              variant="secondary"
              size="sm"
              icon={<DownloadIcon size={18} />}
              prefetch={false}
              data-testid="export-csv"
            >
              Export CSV
            </ButtonLink>
          )
        }
      />
      <form
        method="get"
        className="mb-3 flex flex-wrap items-end gap-2"
        role="search"
        aria-label="Filter orders"
      >
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Search
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="NG-2026-…, email or name"
            className={`${smallField} w-60`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Payment
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className={smallField}
            data-testid="filter-status"
          >
            <option value="">Any payment</option>
            {PAYMENT.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Fulfilment
          <select
            name="fulfilment"
            defaultValue={params.fulfilment ?? ""}
            className={smallField}
            data-testid="filter-fulfilment"
          >
            <option value="">Any fulfilment</option>
            {FULFILMENT_STEPS.map((s) => (
              <option key={s} value={s}>
                {FULFILMENT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          From
          <input type="date" name="from" defaultValue={params.from} className={smallField} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          To
          <input type="date" name="to" defaultValue={params.to} className={smallField} />
        </label>
        <button
          type="submit"
          className="bg-ink hover:bg-ink/85 h-10 rounded-sm px-4 text-sm font-medium text-white"
          data-testid="filter-apply"
        >
          Apply
        </button>
        {filtered && (
          <Link
            href={path}
            className="text-primary inline-flex h-10 items-center px-2 text-sm underline underline-offset-2"
          >
            Clear filters
          </Link>
        )}
      </form>
      <div className="mb-2">
        <ResultCount page={list.page} pageSize={ORDER_PAGE_SIZE} total={list.total} noun="orders" />
      </div>
      <TableWrap label="Orders">
        <thead>
          <tr>
            <SortTh
              label="Order"
              column="orderNumber"
              path={path}
              params={params}
              sort={sort}
              dir={dir}
            />
            <SortTh
              label="Placed"
              column="createdAt"
              path={path}
              params={params}
              sort={sort}
              dir={dir}
            />
            <SortTh
              label="Customer"
              column="customerName"
              path={path}
              params={params}
              sort={sort}
              dir={dir}
            />
            <th scope="col" className={thClass}>
              Payment
            </th>
            <th scope="col" className={thClass}>
              Fulfilment
            </th>
            <th scope="col" className={`${thClass} text-right`}>
              Items
            </th>
            <SortTh
              label="Total"
              column="totalCents"
              path={path}
              params={params}
              sort={sort}
              dir={dir}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {list.rows.length === 0 && (
            <EmptyRow
              colSpan={7}
              title={filtered ? "No orders match these filters" : "No orders yet"}
            >
              {filtered ? (
                <Link href={path} className="text-primary underline underline-offset-2">
                  Clear the filters
                </Link>
              ) : (
                "Orders appear here as soon as a shopper checks out."
              )}
            </EmptyRow>
          )}
          {list.rows.map((o) => (
            <tr key={o.id} className="hover:bg-sunken/40" data-testid="order-row">
              <td className={tdClass}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="text-primary font-medium underline-offset-2 hover:underline"
                >
                  {o.orderNumber}
                </Link>
              </td>
              <td className={`${tdClass} text-muted whitespace-nowrap`}>
                {fmtDateTime(o.createdAt)}
              </td>
              <td className={tdClass}>
                {o.customerName}
                <div className="text-muted text-xs">{o.email}</div>
              </td>
              <td className={tdClass}>
                <PaymentBadge status={o.status} />
              </td>
              <td className={tdClass}>
                <FulfilmentBadge status={o.fulfilmentStatus} muted={o.status !== "paid"} />
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>{o._count.items}</td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {formatMoney(o.totalCents, o.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-4">
        <Pagination
          page={list.page}
          totalPages={list.pageCount}
          hrefFor={(n) => hrefWith(path, params, { page: String(n) })}
        />
      </div>
    </>
  );
}
