/**
 * Admin product management. Prices are entered as dollars ("24.50") and stored
 * as integer cents. Orders keep name and price snapshots, so editing a product
 * never changes a past order.
 */
import { z } from "zod";
import type { Db } from "../db";
import { applyStockChange, recordMovement } from "../inventory/stock";
import { assertCan, fail, type Actor } from "./actor";
import { changedFields, writeAudit } from "./audit";
import type { StoredImage } from "./images";
import { SLUG_MAX, SLUG_RE, slugify } from "./slug";

const MONEY_RE = /^\d{1,6}(?:\.\d{1,2})?$/;

export function parsePriceToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, "");
  if (!MONEY_RE.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

const bool = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true" || v === "1");

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name (2–80 characters).").max(80, "Use 80 characters or fewer."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(SLUG_MAX, `Use ${SLUG_MAX} characters or fewer.`)
      .refine((s) => s === "" || SLUG_RE.test(s), "Use lowercase letters, numbers and single hyphens."),
    shortDescription: z
      .string()
      .trim()
      .min(10, "Write a short description (10–160 characters).")
      .max(160, "Use 160 characters or fewer."),
    description: z
      .string()
      .trim()
      .min(20, "Write a description (20–2,000 characters).")
      .max(2000, "Use 2,000 characters or fewer."),
    price: z.string().trim().min(1, "Enter a price."),
    compareAt: z.string().trim().optional().default(""),
    stock: z.string().trim().optional().default("0"),
    categoryId: z.string().trim().min(1, "Choose a category."),
    isActive: bool,
    isFeatured: bool,
  })
  .transform((v, ctx) => {
    const priceCents = parsePriceToCents(v.price);
    if (priceCents === null || priceCents < 1) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price like 24.00." });
    }
    let compareAtCents: number | null = null;
    if (v.compareAt) {
      compareAtCents = parsePriceToCents(v.compareAt);
      if (compareAtCents === null) {
        ctx.addIssue({ code: "custom", path: ["compareAt"], message: "Enter a price like 30.00, or leave it empty." });
      } else if (priceCents !== null && compareAtCents <= priceCents) {
        ctx.addIssue({
          code: "custom",
          path: ["compareAt"],
          message: "The compare-at price must be higher than the price.",
        });
      }
    }
    const stock = Number(v.stock);
    if (!/^\d{1,6}$/.test(v.stock) || !Number.isSafeInteger(stock)) {
      ctx.addIssue({ code: "custom", path: ["stock"], message: "Enter a whole number from 0 to 999,999." });
    }
    return {
      name: v.name,
      slug: v.slug || slugify(v.name),
      shortDescription: v.shortDescription,
      description: v.description,
      priceCents: priceCents ?? 0,
      compareAtCents,
      stock,
      categoryId: v.categoryId,
      isActive: v.isActive,
      isFeatured: v.isFeatured,
    };
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductData = z.output<typeof productFormSchema>;

export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const AUDITED = [
  "name",
  "slug",
  "priceCents",
  "compareAtCents",
  "categoryId",
  "isActive",
  "isFeatured",
  "shortDescription",
  "description",
] as const;

export type ProductResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function categoryExists(db: Db, id: string) {
  return (await db.category.count({ where: { id } })) === 1;
}

export async function createProduct(
  db: Db,
  actor: Actor,
  data: ProductData,
  image?: StoredImage | null,
): Promise<ProductResult> {
  assertCan(actor, "products.edit");
  if (!(await categoryExists(db, data.categoryId))) {
    return fail("Check the highlighted fields.", { categoryId: "Choose a category." });
  }
  try {
    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          slug: data.slug,
          name: data.name,
          shortDescription: data.shortDescription,
          description: data.description,
          priceCents: data.priceCents,
          compareAtCents: data.compareAtCents,
          stock: data.stock,
          categoryId: data.categoryId,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          imagePath: image?.imagePath ?? "/products/placeholder.svg",
          thumbPath: image?.thumbPath ?? null,
        },
      });
      if (data.stock > 0) {
        await recordMovement(tx, {
          productId: p.id,
          delta: data.stock,
          reason: "initial",
          stockAfter: data.stock,
          actorId: actor.id,
          note: "Opening stock",
        });
      }
      await writeAudit(tx, {
        actorId: actor.id,
        action: "product.create",
        entityType: "Product",
        entityId: p.id,
        summary: {
          name: p.name,
          slug: p.slug,
          priceCents: p.priceCents,
          stock: p.stock,
          image: image ? "uploaded" : "placeholder",
        },
      });
      return p;
    });
    return { ok: true, id: product.id, slug: product.slug };
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return fail("Check the highlighted fields.", { slug: "Another product already uses this slug." });
    }
    throw err;
  }
}

/** Edits everything except stock (stock changes go through adjustments, with a reason). */
export async function updateProduct(
  db: Db,
  actor: Actor,
  id: string,
  data: ProductData,
  image?: StoredImage | null,
): Promise<ProductResult & { replacedImage?: { imagePath: string; thumbPath: string | null } }> {
  assertCan(actor, "products.edit");
  const before = await db.product.findUnique({ where: { id } });
  if (!before) return fail("That product no longer exists.");
  if (!(await categoryExists(db, data.categoryId))) {
    return fail("Check the highlighted fields.", { categoryId: "Choose a category." });
  }
  const next = {
    name: data.name,
    slug: data.slug,
    shortDescription: data.shortDescription,
    description: data.description,
    priceCents: data.priceCents,
    compareAtCents: data.compareAtCents,
    categoryId: data.categoryId,
    isActive: before.archivedAt ? false : data.isActive,
    isFeatured: data.isFeatured,
  };
  try {
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { ...next, ...(image ? { imagePath: image.imagePath, thumbPath: image.thumbPath } : {}) },
      });
      const changes = changedFields(before, next, AUDITED);
      if (image) changes.image = ["previous", "uploaded"];
      await writeAudit(tx, {
        actorId: actor.id,
        action: "product.update",
        entityType: "Product",
        entityId: id,
        summary: { changes },
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return fail("Check the highlighted fields.", { slug: "Another product already uses this slug." });
    }
    throw err;
  }
  return {
    ok: true,
    id,
    slug: data.slug,
    replacedImage: image ? { imagePath: before.imagePath, thumbPath: before.thumbPath } : undefined,
  };
}

/** Archive: hidden from the store and from new carts; kept for order history. */
export async function setArchived(db: Db, actor: Actor, id: string, archived: boolean) {
  assertCan(actor, "products.archive");
  return db.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { id }, select: { archivedAt: true } });
    if (!p) return fail("That product no longer exists.");
    if (!!p.archivedAt === archived) return { ok: true as const };
    await tx.product.update({
      where: { id },
      data: archived ? { archivedAt: new Date(), isActive: false } : { archivedAt: null },
    });
    if (archived) {
      // Archived products leave every cart (pending orders keep their snapshot).
      await tx.cartItem.deleteMany({ where: { productId: id } });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: archived ? "product.archive" : "product.unarchive",
      entityType: "Product",
      entityId: id,
    });
    return { ok: true as const };
  });
}

export type DeleteResult =
  | { ok: true; images: Array<string | null> }
  | { ok: false; error: string; code: "HAS_ORDERS" | "NOT_FOUND" };

/** Hard delete, only for products that no order references (admin only). */
export async function deleteProduct(db: Db, actor: Actor, id: string): Promise<DeleteResult> {
  assertCan(actor, "products.delete");
  return db.$transaction(async (tx) => {
    const p = await tx.product.findUnique({
      where: { id },
      select: { name: true, slug: true, imagePath: true, thumbPath: true, _count: { select: { orderItems: true } } },
    });
    if (!p) return { ok: false as const, error: "That product no longer exists.", code: "NOT_FOUND" as const };
    if (p._count.orderItems > 0) {
      return {
        ok: false as const,
        error: "This product appears in orders, so it can only be archived.",
        code: "HAS_ORDERS" as const,
      };
    }
    await tx.product.delete({ where: { id } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "product.delete",
      entityType: "Product",
      entityId: id,
      summary: { name: p.name, slug: p.slug },
    });
    return { ok: true as const, images: [p.imagePath, p.thumbPath] };
  });
}

// ---------------------------------------------------------------------------
// Stock adjustments (admin and staff)
// ---------------------------------------------------------------------------

export type AdjustInput = {
  productId: string;
  delta: number;
  reason: "received" | "damaged" | "correction" | "return";
  note?: string;
};

export async function adjustStock(db: Db, actor: Actor, input: AdjustInput) {
  assertCan(actor, "products.adjustStock");
  return db.$transaction(async (tx) => {
    const before = await tx.product.findUnique({
      where: { id: input.productId },
      select: { stock: true, name: true },
    });
    if (!before) return fail("That product no longer exists.");
    const after = await applyStockChange(tx, {
      productId: input.productId,
      delta: input.delta,
      reason: input.reason,
      actorId: actor.id,
      note: input.note,
    });
    if (after === null) {
      return fail(`Stock can't go below zero (there are ${before.stock} in stock).`);
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: "stock.adjust",
      entityType: "Product",
      entityId: input.productId,
      summary: { reason: input.reason, delta: input.delta, stock: [before.stock, after] },
    });
    return { ok: true as const, value: after };
  });
}

/**
 * Bulk edit: sets each product's stock to a counted number, as a "correction"
 * movement for the difference. The difference is computed inside the
 * transaction, so a sale in between is not overwritten blindly.
 */
export async function bulkSetStock(
  db: Db,
  actor: Actor,
  rows: Array<{ productId: string; stock: number; expected: number }>,
) {
  assertCan(actor, "products.adjustStock");
  return db.$transaction(async (tx) => {
    let changed = 0;
    const conflicts: string[] = [];
    for (const row of rows) {
      if (!Number.isSafeInteger(row.stock) || row.stock < 0) continue;
      const p = await tx.product.findUnique({
        where: { id: row.productId },
        select: { stock: true, name: true },
      });
      if (!p) continue;
      if (p.stock !== row.expected) {
        // Stock moved (an order, another user) since the table was loaded.
        conflicts.push(p.name);
        continue;
      }
      const delta = row.stock - p.stock;
      if (delta === 0) continue;
      await applyStockChange(tx, {
        productId: row.productId,
        delta,
        reason: "correction",
        actorId: actor.id,
        note: "Bulk stock edit",
      });
      changed++;
      await writeAudit(tx, {
        actorId: actor.id,
        action: "stock.bulk_set",
        entityType: "Product",
        entityId: row.productId,
        summary: { stock: [p.stock, row.stock] },
      });
    }
    return { ok: true as const, value: { changed, conflicts } };
  });
}
