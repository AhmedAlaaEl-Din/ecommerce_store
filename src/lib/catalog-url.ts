import type { CatalogQuery, SortOption } from "./schemas";

export type CatalogParams = {
  category?: string | null;
  q?: string | null;
  sort?: SortOption | null;
  page?: number | null;
};

/** Builds a /products URL, omitting defaults so URLs stay short and shareable. */
export function catalogHref(params: CatalogParams): string {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  const q = params.q?.trim();
  if (q) sp.set("q", q);
  if (params.sort && params.sort !== "newest") sp.set("sort", params.sort);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return s ? `/products?${s}` : "/products";
}

export function withChanges(current: CatalogQuery, changes: CatalogParams): string {
  const merged: CatalogParams = { ...current, ...changes };
  // Any change other than the page itself goes back to page 1.
  if (!("page" in changes)) merged.page = 1;
  return catalogHref(merged);
}

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};
