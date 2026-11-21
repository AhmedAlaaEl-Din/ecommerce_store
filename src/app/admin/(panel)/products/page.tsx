import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  DoneNotice,
  EmptyRow,
  PageHeader,
  Pill,
  ResultCount,
  smallField,
  SortTh,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { PlusIcon } from "@/components/icons";
import { hrefWith, oneOf, pageParam, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { getLowStockThreshold } from "@/lib/admin/inventory";
import {
  listAdminProducts,
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORTS,
  PRODUCT_STATES,
} from "@/lib/admin/product-list";
import { can } from "@/lib/admin/roles";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

const DONE = { deleted: "Product deleted." };

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { user } = await requireAdmin();
  const sp = await searchParams;
  const params = {
    q: param(sp, "q"),
    category: param(sp, "category"),
    state: oneOf(param(sp, "state"), PRODUCT_STATES),
    low: param(sp, "low") === "1" ? "1" : undefined,
    sort: oneOf(param(sp, "sort"), PRODUCT_SORTS),
    dir: oneOf(param(sp, "dir"), ["asc", "desc"] as const),
    page: param(sp, "page"),
  };
  const [threshold, categories] = await Promise.all([
    getLowStockThreshold(db),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const list = await listAdminProducts(
    db,
    {
      q: params.q,
      categoryId: params.category,
      state: params.state,
      low: !!params.low,
      sort: params.sort,
      dir: params.dir,
      page: pageParam(params.page),
    },
    threshold,
  );
  const canEdit = can(user.role, "products.edit");
  const path = "/admin/products";

  return (
    <>
      <PageHeader
        title="Products"
        description="Search, filter and edit the catalog. Archived products stay in past orders but leave the store."
        actions={
          canEdit && (
            <ButtonLink href="/admin/products/new" size="sm" icon={<PlusIcon size={18} />} data-testid="new-product">
              New product
            </ButtonLink>
          )
        }
      />
      <DoneNotice code={param(sp, "done")} messages={DONE} />

      <form method="get" className="mb-3 flex flex-wrap items-end gap-2" role="search" aria-label="Filter products">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Search
          <input type="search" name="q" defaultValue={params.q} placeholder="Name or slug" className={`${smallField} w-56`} />
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
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Status
          <select name="state" defaultValue={params.state ?? "active"} className={smallField}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="inline-flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={!!params.low} className="accent-primary size-4" />
          Low stock (≤ {threshold})
        </label>
        <button type="submit" className="bg-ink hover:bg-ink/85 h-10 rounded-sm px-4 text-sm font-medium text-white">
          Apply
        </button>
        <Link href={path} className="text-primary inline-flex h-10 items-center px-2 text-sm underline underline-offset-2">
          Reset
        </Link>
      </form>

      <div className="mb-2 flex items-center justify-between">
        <ResultCount page={list.page} pageSize={PRODUCT_PAGE_SIZE} total={list.total} noun="products" />
      </div>
      <TableWrap label="Products">
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              <span className="sr-only">Image</span>
            </th>
            <SortTh label="Name" column="name" path={path} params={params} sort={list.sort} dir={list.dir} />
            <th scope="col" className={thClass}>Category</th>
            <SortTh label="Price" column="priceCents" path={path} params={params} sort={list.sort} dir={list.dir} align="right" />
            <SortTh label="Stock" column="stock" path={path} params={params} sort={list.sort} dir={list.dir} align="right" />
            <th scope="col" className={thClass}>Status</th>
            <SortTh label="Added" column="createdAt" path={path} params={params} sort={list.sort} dir={list.dir} />
          </tr>
        </thead>
        <tbody>
          {list.rows.length === 0 && (
            <EmptyRow colSpan={7} title="No products match these filters">
              <Link href={path} className="text-primary underline underline-offset-2">
                Reset the filters
              </Link>
            </EmptyRow>
          )}
          {list.rows.map((p) => (
            <tr key={p.id} className="hover:bg-sunken/40" data-testid="product-row">
              <td className={`${tdClass} w-14`}>
                <Image
                  src={p.thumbPath ?? p.imagePath}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="size-10 rounded-sm object-cover"
                  style={{ backgroundColor: p.category.accentColor }}
                />
              </td>
              <td className={tdClass}>
                <Link href={`/admin/products/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                  {p.name}
                </Link>
                <div className="text-muted text-xs">/{p.slug}</div>
              </td>
              <td className={tdClass}>{p.category.name}</td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {formatMoney(p.priceCents, p.currency)}
                {p.compareAtCents && (
                  <div className="text-muted text-xs line-through">{formatMoney(p.compareAtCents, p.currency)}</div>
                )}
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>
                <span className={p.stock <= threshold ? (p.stock === 0 ? "text-danger font-semibold" : "text-warning font-semibold") : undefined}>
                  {p.stock}
                </span>
              </td>
              <td className={tdClass}>
                <span className="flex flex-wrap gap-1">
                  {p.archivedAt ? (
                    <Pill tone="neutral">Archived</Pill>
                  ) : p.isActive ? (
                    <Pill tone="good">Active</Pill>
                  ) : (
                    <Pill tone="warn">Inactive</Pill>
                  )}
                  {p.isFeatured && !p.archivedAt && <Pill tone="info">Featured</Pill>}
                </span>
              </td>
              <td className={`${tdClass} text-muted whitespace-nowrap`}>
                {p.createdAt.toISOString().slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-4">
        <Pagination page={list.page} totalPages={list.pageCount} hrefFor={(n) => hrefWith(path, params, { page: String(n) })} />
      </div>
    </>
  );
}
