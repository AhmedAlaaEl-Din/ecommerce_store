import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ProductForm } from "@/components/admin/ProductForm";
import { DoneNotice, Notice, PageHeader, Panel, Pill } from "@/components/admin/ui";
import { ExternalIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { fmtDateTime, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { centsToInput } from "@/lib/admin/products";
import { can } from "@/lib/admin/roles";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { archiveProductAction, deleteProductAction, updateProductAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product" };

const DONE = {
  created: "Product created.",
  saved: "Changes saved.",
  archived: "Product archived. It no longer appears in the store or in carts.",
  unarchived: "Product restored. It stays inactive until you tick Active and save.",
};

export default async function AdminProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { user } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const product = await db.product.findUnique({
    where: { id },
    include: { category: true, _count: { select: { orderItems: true } } },
  });
  if (!product) notFound();
  const done = param(sp, "done");
  const canEdit = can(user.role, "products.edit");
  const status = product.archivedAt ? (
    <Pill tone="neutral">Archived</Pill>
  ) : product.isActive ? (
    <Pill tone="good">Active</Pill>
  ) : (
    <Pill tone="warn">Inactive</Pill>
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {product.name} {status}
          </span>
        }
        description={`Added ${fmtDateTime(product.createdAt)} · in ${product._count.orderItems} order line${product._count.orderItems === 1 ? "" : "s"}`}
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          <>
            {!product.archivedAt && product.isActive && (
              <ButtonLink href={`/products/${product.slug}`} variant="secondary" size="sm" target="_blank" icon={<ExternalIcon size={16} />}>
                View in store
              </ButtonLink>
            )}
            <ButtonLink href={`/admin/inventory/${product.id}`} variant="secondary" size="sm">
              Stock history
            </ButtonLink>
          </>
        }
      />
      <DoneNotice code={done} messages={DONE} />
      {done === "has_orders" && (
        <Notice tone="error">This product appears in orders, so it can’t be deleted. Archive it instead.</Notice>
      )}
      {done === "error" && <Notice tone="error">That didn’t work. Reload the page and try again.</Notice>}

      {canEdit ? (
        <>
          <ProductForm
            mode="edit"
            action={updateProductAction.bind(null, product.id)}
            categories={await db.category.findMany({
              orderBy: { name: "asc" },
              select: { id: true, name: true, accentColor: true },
            })}
            initial={{
              name: product.name,
              slug: product.slug,
              shortDescription: product.shortDescription,
              description: product.description,
              price: centsToInput(product.priceCents),
              compareAt: centsToInput(product.compareAtCents),
              stock: String(product.stock),
              categoryId: product.categoryId,
              isActive: product.isActive,
              isFeatured: product.isFeatured,
              imagePath: product.thumbPath ?? product.imagePath,
            }}
          />
          <Panel title="Archive or delete" className="mt-6" id="danger-zone">
            <div className="flex flex-col gap-4 text-sm sm:flex-row sm:items-start sm:justify-between">
              <p className="text-muted max-w-xl">
                {product.archivedAt
                  ? "Archived products are hidden from the store and can’t be added to carts. Restore it to edit and sell it again."
                  : product._count.orderItems > 0
                    ? "This product is in past orders, so it can be archived but not deleted. Archiving hides it from the store and removes it from carts; orders keep their copy of its name and price."
                    : "No order uses this product yet, so it can be deleted for good, or archived to keep it."}
              </p>
              <div className="flex shrink-0 flex-wrap gap-2">
                {product.archivedAt ? (
                  <form action={archiveProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <input type="hidden" name="archive" value="0" />
                    <button type="submit" className="border-line-strong hover:border-ink inline-flex min-h-11 items-center rounded-md border px-3.5 text-sm font-medium sm:min-h-9" data-testid="unarchive">
                      Restore
                    </button>
                  </form>
                ) : (
                  <ConfirmDialog
                    testId="archive"
                    triggerLabel="Archive"
                    title={`Archive “${product.name}”?`}
                    confirmLabel="Archive product"
                    action={archiveProductAction}
                    hidden={{ id: product.id, archive: "1" }}
                  >
                    It disappears from the store and from every cart. Past orders are not changed. You can restore it later.
                  </ConfirmDialog>
                )}
                {product._count.orderItems === 0 && (
                  <ConfirmDialog
                    testId="delete-product"
                    triggerLabel="Delete"
                    title={`Delete “${product.name}” for good?`}
                    confirmLabel="Delete product"
                    action={deleteProductAction}
                    hidden={{ id: product.id }}
                  >
                    This can’t be undone. Its stock history is deleted too.
                  </ConfirmDialog>
                )}
              </div>
            </div>
          </Panel>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Image
            src={product.thumbPath ?? product.imagePath}
            alt=""
            width={256}
            height={256}
            unoptimized
            className="rounded-lg"
            style={{ backgroundColor: product.category.accentColor }}
          />
          <Panel title="Details" id="details">
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Slug</dt>
              <dd>/{product.slug}</dd>
              <dt className="text-muted">Category</dt>
              <dd>{product.category.name}</dd>
              <dt className="text-muted">Price</dt>
              <dd>{formatMoney(product.priceCents, product.currency)}</dd>
              <dt className="text-muted">Stock</dt>
              <dd className="tabular-nums">{product.stock}</dd>
              <dt className="text-muted">Short description</dt>
              <dd>{product.shortDescription}</dd>
            </dl>
            <p className="text-muted mt-4 text-sm">
              Staff can view products and adjust stock. Editing is for admins.{" "}
              <Link href={`/admin/inventory/${product.id}`} className="text-primary underline underline-offset-2">
                Adjust stock
              </Link>
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}
