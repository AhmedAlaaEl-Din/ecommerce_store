import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { updateCategoryAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: PageProps<"/admin/categories/[id]">) {
  await requireAdmin("admin");
  const { id } = await params;
  const c = await db.category.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} back={{ href: "/admin/categories", label: "Categories" }} />
      <Panel className="max-w-xl" id="edit-category">
        <CategoryForm
          action={updateCategoryAction.bind(null, c.id)}
          initial={{ name: c.name, slug: c.slug, description: c.description, accentColor: c.accentColor }}
          submitLabel="Save changes"
        />
      </Panel>
    </>
  );
}
