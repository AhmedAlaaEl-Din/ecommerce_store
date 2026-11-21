// Plain constants shared by server and client code. Kept free of zod so that
// client bundles do not pull in the validation library (zod v4 probes `eval`,
// which the Content-Security-Policy blocks).

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const PAGE_SIZE = 12;

/** Shape of the parsed catalog query string (validated by catalogQuerySchema). */
export type CatalogQuery = {
  category?: string;
  q?: string;
  sort: SortOption;
  page: number;
};
