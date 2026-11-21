import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StockAdjustForm } from "@/components/admin/StockAdjustForm";
import {
  EmptyRow,
  PageHeader,
  Panel,
  Pill,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDateTime, pageParam, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { getLowStockThreshold, productMovements } from "@/lib/admin/inventory";
import { db } from "@/lib/db";
import { REASON_LABELS, type StockReason } from "@/lib/inventory/stock";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stock history" };

export default async function StockHistoryPage({
  params,
  searchParams,
}: PageProps<"/admin/inventory/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      stock: true,
      archivedAt: true,
      category: { select: { name: true } },
    },
  });
  if (!product) notFound();
  const [threshold, history] = await Promise.all([
    getLowStockThreshold(db),
    productMovements(db, id, pageParam(param(sp, "page"))),
  ]);
  const balanced = history.sumOfMovements === product.stock;

  return (
    <>
      <PageHeader
        title={`Stock: ${product.name}`}
        description={product.category.name}
        back={{ href: "/admin/inventory", label: "Inventory" }}
        actions={
          <Link
            href={`/admin/products/${product.id}`}
            className="text-primary text-sm font-medium underline underline-offset-2"
          >
            Product details
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span>
              In stock:{" "}
              <strong className="font-display text-2xl tabular-nums" data-testid="current-stock">
                {product.stock}
              </strong>
            </span>
            {product.stock <= threshold && (
              <Pill tone={product.stock === 0 ? "bad" : "warn"}>Low stock</Pill>
            )}
            <span className="text-muted" data-testid="balance-check">
              {balanced
                ? `Movements add up to ${history.sumOfMovements} ✓`
                : `Movements add up to ${history.sumOfMovements}, stock is ${product.stock}: check the history.`}
            </span>
          </div>
          <TableWrap label="Stock movements">
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  When
                </th>
                <th scope="col" className={thClass}>
                  Reason
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Change
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  After
                </th>
                <th scope="col" className={thClass}>
                  By / order
                </th>
                <th scope="col" className={thClass}>
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {history.rows.length === 0 && <EmptyRow colSpan={6} title="No stock movements yet" />}
              {history.rows.map((m) => (
                <tr key={m.id} data-testid="movement-row">
                  <td className={`${tdClass} text-muted whitespace-nowrap`}>
                    {fmtDateTime(m.createdAt)}
                  </td>
                  <td className={tdClass}>{REASON_LABELS[m.reason as StockReason] ?? m.reason}</td>
                  <td
                    className={`${tdClass} text-right font-semibold tabular-nums ${m.delta > 0 ? "text-success" : "text-danger"}`}
                  >
                    {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{m.stockAfter}</td>
                  <td className={tdClass}>
                    {m.order ? (
                      <Link
                        href={`/admin/orders/${m.order.id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {m.order.orderNumber}
                      </Link>
                    ) : (
                      (m.actor?.name ?? <span className="text-muted">System</span>)
                    )}
                  </td>
                  <td className={`${tdClass} text-muted max-w-56 truncate`}>{m.note}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div className="mt-4">
            <Pagination
              page={history.page}
              totalPages={history.pageCount}
              hrefFor={(n) => `/admin/inventory/${product.id}?page=${n}`}
            />
          </div>
        </div>
        <Panel title="Adjust stock" id="adjust">
          {product.archivedAt ? (
            <p className="text-muted text-sm">
              This product is archived. Restore it to change its stock.
            </p>
          ) : (
            <StockAdjustForm productId={product.id} />
          )}
        </Panel>
      </div>
    </>
  );
}
