import type { Metadata } from "next";
import Link from "next/link";
import {
  DoneNotice,
  EmptyRow,
  Notice,
  PageHeader,
  Panel,
  Pill,
  smallField,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { hrefWith, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { getLowStockThreshold, listInventory } from "@/lib/admin/inventory";
import { can } from "@/lib/admin/roles";
import { db } from "@/lib/db";
import { bulkStockAction, thresholdAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const { user } = await requireAdmin();
  const sp = await searchParams;
  const params = {
    q: param(sp, "q"),
    category: param(sp, "category"),
    low: param(sp, "low") === "1" ? "1" : undefined,
  };
  const [threshold, categories] = await Promise.all([
    getLowStockThreshold(db),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const rows = await listInventory(
    db,
    { q: params.q, categoryId: params.category, low: !!params.low },
    threshold,
  );
  const done = param(sp, "done");
  const changed = Number.parseInt(param(sp, "changed") ?? "0", 10) || 0;
  const back = hrefWith("", params);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every stock change is recorded with a reason, so the history explains each number. Archived products are not listed."
      />
      <DoneNotice
        code={done}
        messages={{
          bulk_saved: `Saved. ${changed} product${changed === 1 ? "" : "s"} updated.`,
          threshold_saved: `Low-stock threshold saved.`,
        }}
      />
      {done === "bulk_conflicts" && (
        <Notice tone="error">
          {changed} product{changed === 1 ? "" : "s"} updated. Some rows were skipped because their
          stock changed while you were editing (an order or another user). Check them and try again.
        </Notice>
      )}
      {done === "threshold_invalid" && (
        <Notice tone="error">Enter a whole number from 0 to 1,000.</Notice>
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <form
          method="get"
          className="flex flex-wrap items-end gap-2"
          role="search"
          aria-label="Filter inventory"
        >
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Search
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Name or slug"
              className={`${smallField} w-52`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Category
            <select name="category" defaultValue={params.category ?? ""} className={smallField}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={!!params.low}
              className="accent-primary size-4"
            />
            Low stock only
          </label>
          <button
            type="submit"
            className="bg-ink hover:bg-ink/85 h-10 rounded-sm px-4 text-sm font-medium text-white"
          >
            Apply
          </button>
        </form>
        {can(user.role, "inventory.settings") ? (
          <form
            action={thresholdAction}
            className="flex items-end gap-2"
            data-testid="threshold-form"
          >
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Low-stock threshold
              <input
                type="number"
                name="threshold"
                min={0}
                max={1000}
                defaultValue={threshold}
                className={`${smallField} w-24`}
              />
            </label>
            <button
              type="submit"
              className="border-line-strong hover:border-ink h-10 rounded-sm border px-3 text-sm font-medium"
            >
              Save
            </button>
          </form>
        ) : (
          <p className="text-muted text-sm">Low stock means {threshold} or fewer.</p>
        )}
      </div>

      <form action={bulkStockAction} data-testid="bulk-form">
        <input type="hidden" name="back" value={back} />
        <TableWrap label="Inventory">
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                Product
              </th>
              <th scope="col" className={thClass}>
                Category
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                In stock
              </th>
              <th scope="col" className={thClass}>
                Counted (bulk edit)
              </th>
              <th scope="col" className={thClass}>
                <span className="sr-only">History</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={5} title="No products match">
                <Link href="/admin/inventory" className="text-primary underline underline-offset-2">
                  Show everything
                </Link>
              </EmptyRow>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-sunken/40" data-testid="inventory-row">
                <td className={tdClass}>
                  <span className="font-medium">{p.name}</span>
                  {!p.isActive && (
                    <span className="ml-2">
                      <Pill tone="warn">Inactive</Pill>
                    </span>
                  )}
                </td>
                <td className={tdClass}>{p.category.name}</td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  <span
                    className={
                      p.stock <= threshold
                        ? p.stock === 0
                          ? "text-danger font-semibold"
                          : "text-warning font-semibold"
                        : undefined
                    }
                  >
                    {p.stock}
                  </span>
                </td>
                <td className={tdClass}>
                  <input type="hidden" name={`expected_${p.id}`} value={p.stock} />
                  <label className="sr-only" htmlFor={`stock-${p.id}`}>
                    Counted stock for {p.name}
                  </label>
                  <input
                    id={`stock-${p.id}`}
                    name={`stock_${p.id}`}
                    type="number"
                    min={0}
                    max={999999}
                    inputMode="numeric"
                    placeholder={String(p.stock)}
                    className={`${smallField} w-24 tabular-nums`}
                    data-testid={`bulk-${p.slug}`}
                  />
                </td>
                <td className={`${tdClass} text-right`}>
                  <Link
                    href={`/admin/inventory/${p.id}`}
                    className="text-primary inline-flex min-h-9 items-center px-2 text-sm font-medium underline underline-offset-2"
                  >
                    History &amp; adjust
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        {rows.length > 0 && (
          <div className="border-line bg-surface sticky bottom-0 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <p className="text-muted text-sm">
              Type counted numbers in any rows, then save them all at once. Each change is recorded
              as a correction.
            </p>
            <button
              type="submit"
              className="bg-primary hover:bg-primary-hover h-10 rounded-md px-4 text-sm font-medium text-white"
              data-testid="bulk-save"
            >
              Save counted stock
            </button>
          </div>
        )}
      </form>
      <Panel className="mt-6" title="About stock numbers" id="about-stock">
        <p className="text-muted text-sm">
          Stock is the number available to sell. Checkout reserves stock for 30 minutes (a
          “reserved” movement); a cancelled, declined or expired checkout puts it back (“released”).
          Refunds can restock items. Manual changes need a reason.
        </p>
      </Panel>
    </>
  );
}
