"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import {
  checkUpload,
  deleteStoredImage,
  processAndStoreImage,
  type StoredImage,
} from "@/lib/admin/images";
import {
  createProduct,
  deleteProduct,
  fieldErrorsOf,
  productFormSchema,
  setArchived,
  updateProduct,
} from "@/lib/admin/products";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";

export type ProductFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function readForm(fd: FormData) {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return productFormSchema.safeParse({
    name: s("name"),
    slug: s("slug"),
    shortDescription: s("shortDescription"),
    description: s("description"),
    price: s("price"),
    compareAt: s("compareAt"),
    stock: s("stock") || "0",
    categoryId: s("categoryId"),
    isActive: fd.get("isActive") ?? "",
    isFeatured: fd.get("isFeatured") ?? "",
  });
}

/** Validates and stores the optional image. Returns null when no file was chosen. */
async function readImage(fd: FormData): Promise<{ image: StoredImage | null } | { error: string }> {
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return { image: null };
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = checkUpload(file, bytes.subarray(0, 16));
  if (!check.ok) return { error: check.error };
  try {
    return { image: await processAndStoreImage(bytes) };
  } catch (err) {
    logError("admin-products", "image processing failed", err);
    return { error: "That file could not be read as an image. Try another JPEG, PNG or WebP." };
  }
}

export async function createProductAction(
  _prev: ProductFormState,
  fd: FormData,
): Promise<ProductFormState> {
  const { user } = await requireAdmin("admin");
  const parsed = readForm(fd);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const img = await readImage(fd);
  if ("error" in img) return { error: img.error, fieldErrors: { image: img.error } };
  const res = await (async () => {
    try {
      return createProduct(db, user, parsed.data, img.image);
    } catch (err) {
      await deleteStoredImage([img.image?.imagePath, img.image?.thumbPath]);
      throw err;
    }
  })();
  if (!res.ok) {
    await deleteStoredImage([img.image?.imagePath, img.image?.thumbPath]);
    return { error: res.error, fieldErrors: res.fieldErrors };
  }
  revalidatePath("/", "layout");
  redirect(`/admin/products/${res.id}?done=created`);
}

export async function updateProductAction(
  id: string,
  _prev: ProductFormState,
  fd: FormData,
): Promise<ProductFormState> {
  const { user } = await requireAdmin("admin");
  const parsed = readForm(fd);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const img = await readImage(fd);
  if ("error" in img) return { error: img.error, fieldErrors: { image: img.error } };
  const res = await (async () => {
    try {
      return updateProduct(db, user, String(id), parsed.data, img.image);
    } catch (err) {
      await deleteStoredImage([img.image?.imagePath, img.image?.thumbPath]);
      throw err;
    }
  })();
  if (!res.ok) {
    await deleteStoredImage([img.image?.imagePath, img.image?.thumbPath]);
    return { error: res.error, fieldErrors: res.fieldErrors };
  }
  if (res.replacedImage) {
    await deleteStoredImage([res.replacedImage.imagePath, res.replacedImage.thumbPath]);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/products/${res.id}?done=saved`);
}

export async function archiveProductAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const id = String(fd.get("id") ?? "");
  const archive = fd.get("archive") === "1";
  const res = await setArchived(db, user, id, archive);
  revalidatePath("/", "layout");
  redirect(
    `/admin/products/${encodeURIComponent(id)}?done=${res.ok ? (archive ? "archived" : "unarchived") : "error"}`,
  );
}

export async function deleteProductAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const id = String(fd.get("id") ?? "");
  const res = await deleteProduct(db, user, id);
  if (!res.ok) {
    redirect(
      `/admin/products/${encodeURIComponent(id)}?done=${res.code === "HAS_ORDERS" ? "has_orders" : "error"}`,
    );
  }
  await deleteStoredImage(res.images);
  revalidatePath("/", "layout");
  redirect("/admin/products?done=deleted");
}
