import { z } from "zod";
import { MAX_QUANTITY_PER_LINE } from "./cart/math";

/** Product ids are Prisma cuids: lowercase alphanumerics, about 25 characters. */
export const productIdSchema = z
  .string()
  .min(8)
  .max(40)
  .regex(/^[a-z0-9]+$/, "Invalid product id");

/** Server actions receive typed values, so no coercion: "5", true or ["5"] are rejected. */
export const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY_PER_LINE);

export const addToCartSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema.default(1),
});

export const updateCartItemSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema,
});

export const removeCartItemSchema = z.object({
  productId: productIdSchema,
});

export const restoreCartItemSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema,
});

/** Cart ids are random UUIDs that we generate; anything else in the cookie is ignored. */
export const cartIdSchema = z.uuid();

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const PAGE_SIZE = 12;

const firstValue = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/**
 * Catalog query string. Invalid values fall back to defaults instead of erroring,
 * so a hand-edited URL never shows an error page.
 */
export const catalogQuerySchema = z.object({
  category: z.preprocess(
    firstValue,
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{1,40}$/)
      .optional()
      .catch(undefined),
  ),
  q: z.preprocess(
    firstValue,
    z
      .string()
      .trim()
      .max(80)
      .transform((s) => s.replace(/\s+/g, " "))
      .optional()
      .catch(undefined),
  ),
  sort: z.preprocess(firstValue, z.enum(SORT_OPTIONS).catch("newest").default("newest")),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(1000).catch(1).default(1)),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
