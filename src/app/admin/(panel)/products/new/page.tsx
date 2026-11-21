import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { createProductAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin("admin");
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, accentColor: true },
  });
  return (
    <>
      <PageHeader title="New product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm
        mode="create"
        action={createProductAction}
        categories={categories}
        initial={{
          name: "",
          slug: "",
          shortDescription: "",
          description: "",
          price: "",
          compareAt: "",
          stock: "0",
          categoryId: categories[0]?.id ?? "",
          isActive: true,
          isFeatured: false,
          imagePath: "/products/placeholder.svg",
        }}
      />
    </>
  );
}
