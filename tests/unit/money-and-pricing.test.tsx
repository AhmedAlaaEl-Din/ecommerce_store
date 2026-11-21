import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Price } from "@/components/ui/Price";
import { formatMoney } from "@/lib/money";
import { getSaleInfo, getStockStatus } from "@/lib/pricing";

describe("formatMoney", () => {
  it("formats integer cents as en-US dollars", () => {
    expect(formatMoney(4800)).toBe("$48.00");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5)).toBe("$0.05");
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatMoney(-1999)).toBe("-$19.99");
  });

  it("supports other currencies", () => {
    expect(formatMoney(1000, "EUR")).toBe("€10.00");
  });

  it("refuses non-integer amounts (money is never a float)", () => {
    expect(() => formatMoney(10.5)).toThrow(TypeError);
    expect(() => formatMoney(Number.NaN)).toThrow(TypeError);
  });
});

describe("getSaleInfo", () => {
  it("is on sale only when compare-at is higher than the price", () => {
    expect(getSaleInfo(9600, 12800)).toEqual({
      onSale: true,
      compareAtCents: 12800,
      savingsCents: 3200,
      percentOff: 25,
    });
    expect(getSaleInfo(1000, null)).toEqual({ onSale: false });
    expect(getSaleInfo(1000, undefined)).toEqual({ onSale: false });
    expect(getSaleInfo(1000, 1000)).toEqual({ onSale: false });
    expect(getSaleInfo(1000, 900)).toEqual({ onSale: false });
  });

  it("rounds the percentage", () => {
    const s = getSaleInfo(1900, 2600);
    expect(s.onSale && s.percentOff).toBe(27);
  });
});

describe("getStockStatus", () => {
  it("classifies stock", () => {
    expect(getStockStatus(0)).toBe("out");
    expect(getStockStatus(-1)).toBe("out");
    expect(getStockStatus(1)).toBe("low");
    expect(getStockStatus(3)).toBe("low");
    expect(getStockStatus(4)).toBe("in");
  });
});

describe("<Price>", () => {
  it("shows a plain price when not on sale", () => {
    const html = renderToStaticMarkup(<Price priceCents={4800} />);
    expect(html).toContain("$48.00");
    expect(html).not.toContain("<s");
  });

  it("shows the sale price and a struck-through compare-at price, with screen-reader text", () => {
    const html = renderToStaticMarkup(<Price priceCents={9600} compareAtCents={12800} />);
    expect(html).toMatch(/<s[^>]*>\$128\.00<\/s>/);
    expect(html).toContain("Sale price $96.00, was $128.00.");
    expect(html).toContain("text-accent");
  });

  it("ignores a compare-at price that is not higher", () => {
    const html = renderToStaticMarkup(<Price priceCents={9600} compareAtCents={9000} />);
    expect(html).not.toContain("<s");
  });
});
