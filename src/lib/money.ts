const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency });
    formatters.set(currency, f);
  }
  return f;
}

/**
 * Formats an integer amount of cents as a currency string, e.g. 4800 -> "$48.00".
 * Money is always stored and calculated as integer cents; dividing by 100 happens
 * only here, for display.
 */
export function formatMoney(cents: number, currency = "USD"): string {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`formatMoney expects integer cents, got ${cents}`);
  }
  return formatterFor(currency).format(cents / 100);
}
