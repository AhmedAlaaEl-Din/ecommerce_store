"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory,
  deleteCategory,
  parseCategoryForm,
  updateCategory,
} from "@/lib/admin/categories";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";

export type CategoryFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createCategoryAction(
  _prev: CategoryFormState,
  fd: FormData,
): Promise<CategoryFormState> {
  const { user } = await requireAdmin("admin");
  const parsed = parseCategoryForm(fd);
  if (!parsed.ok)
    return { error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  const res = await createCategory(db, user, parsed.data);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect("/admin/categories?done=created");
}

export async function updateCategoryAction(
  id: string,
  _prev: CategoryFormState,
  fd: FormData,
): Promise<CategoryFormState> {
  const { user } = await requireAdmin("admin");
  const parsed = parseCategoryForm(fd);
  if (!parsed.ok)
    return { error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  const res = await updateCategory(db, user, String(id), parsed.data);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/", "layout");
  redirect("/admin/categories?done=saved");
}

export async function deleteCategoryAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const id = String(fd.get("id") ?? "");
  const res = await deleteCategory(db, user, id);
  revalidatePath("/", "layout");
  redirect(`/admin/categories?done=${res.ok ? "deleted" : "has_products"}`);
}
