export type SaleInfo =
  | { onSale: false }
  | { onSale: true; compareAtCents: number; savingsCents: number; percentOff: number };

/** A product is on sale only when compare-at is set and strictly higher than the price. */
export function getSaleInfo(
  priceCents: number,
  compareAtCents: number | null | undefined,
): SaleInfo {
  if (compareAtCents == null || compareAtCents <= priceCents || priceCents < 0) {
    return { onSale: false };
  }
  const savingsCents = compareAtCents - priceCents;
  const percentOff = Math.round((savingsCents / compareAtCents) * 100);
  return { onSale: true, compareAtCents, savingsCents, percentOff };
}

export const LOW_STOCK_THRESHOLD = 3;

export type StockStatus = "out" | "low" | "in";

export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in";
}
