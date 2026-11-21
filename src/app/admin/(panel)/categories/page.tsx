import type { Metadata } from "next";
import Link from "next/link";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  DoneNotice,
  EmptyRow,
  Notice,
  PageHeader,
  Panel,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { createCategoryAction, deleteCategoryAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categories" };

const DONE = {
  created: "Category created.",
  saved: "Category saved.",
  deleted: "Category deleted.",
};

export default async function AdminCategoriesPage({
  searchParams,
}: PageProps<"/admin/categories">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const done = param(sp, "done");
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader
        title="Categories"
        description="Admins only. A category can’t be deleted while it has products."
      />
      <DoneNotice code={done} messages={DONE} />
      {done === "has_products" && (
        <Notice tone="error">
          That category still has products. Move them to another category, or delete them, first.
        </Notice>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <TableWrap label="Categories">
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                Name
              </th>
              <th scope="col" className={thClass}>
                Slug
              </th>
              <th scope="col" className={thClass}>
                Colour
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Products
              </th>
              <th scope="col" className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <EmptyRow colSpan={5} title="No categories yet">
                Create one with the form.
              </EmptyRow>
            )}
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-sunken/40" data-testid="category-row">
                <td className={tdClass}>
                  <Link
                    href={`/admin/categories/${c.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-muted max-w-md truncate text-xs">{c.description}</div>
                </td>
                <td className={`${tdClass} text-muted`}>{c.slug}</td>
                <td className={tdClass}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="border-line size-5 rounded-sm border"
                      style={{ backgroundColor: c.accentColor }}
                    />
                    <span className="text-muted text-xs">{c.accentColor}</span>
                  </span>
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  <Link
                    href={`/admin/products?category=${c.id}&state=all`}
                    className="underline-offset-2 hover:underline"
                  >
                    {c._count.products}
                  </Link>
                </td>
                <td className={`${tdClass} text-right`}>
                  <span className="inline-flex gap-2">
                    <Link
                      href={`/admin/categories/${c.id}`}
                      className="text-primary inline-flex min-h-9 items-center px-2 text-sm font-medium underline underline-offset-2"
                    >
                      Edit
                    </Link>
                    {c._count.products === 0 && (
                      <ConfirmDialog
                        testId={`delete-category-${c.slug}`}
                        triggerLabel="Delete"
                        title={`Delete “${c.name}”?`}
                        confirmLabel="Delete category"
                        action={deleteCategoryAction}
                        hidden={{ id: c.id }}
                      >
                        It has no products. This can’t be undone.
                      </ConfirmDialog>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <Panel title="New category" id="new-category">
          <CategoryForm
            action={createCategoryAction}
            initial={{ name: "", slug: "", description: "", accentColor: "#E8D9C4" }}
            submitLabel="Create category"
          />
        </Panel>
      </div>
    </>
  );
}
