import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";
import { MAX_QUANTITY_PER_LINE, maxPerLine, remainingAddable } from "@/lib/cart/math";

describe("Button loading state", () => {
  it("stays enabled-looking while loading: no native disabled, busy cursor, aria-busy", () => {
    const html = renderToStaticMarkup(<Button loading>Adding…</Button>);
    expect(html).not.toMatch(/\sdisabled=""/);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("cursor-progress");
    expect(html).toContain("bg-primary text-white");
  });

  it("ignores a disabled prop while loading, so the pale disabled style never shows", () => {
    const html = renderToStaticMarkup(
      <Button loading disabled>
        Adding…
      </Button>,
    );
    expect(html).not.toMatch(/\sdisabled=""/);
  });

  it("is natively disabled (pale style, not-allowed cursor) when disabled and not loading", () => {
    const html = renderToStaticMarkup(<Button disabled>Out of stock</Button>);
    expect(html).toMatch(/\sdisabled=""/);
    expect(html).not.toContain("cursor-progress");
    expect(html).not.toContain("aria-busy");
  });
});

describe("maxPerLine / remainingAddable", () => {
  it("caps a line at stock and at the per-line limit", () => {
    expect(maxPerLine(5)).toBe(5);
    expect(maxPerLine(0)).toBe(0);
    expect(maxPerLine(-3)).toBe(0);
    expect(maxPerLine(500)).toBe(MAX_QUANTITY_PER_LINE);
    expect(maxPerLine(Number.NaN)).toBe(0);
  });

  it("returns what can still be added given the cart quantity", () => {
    expect(remainingAddable(5, 0)).toBe(5);
    expect(remainingAddable(5, 3)).toBe(2);
    expect(remainingAddable(5, 5)).toBe(0);
    expect(remainingAddable(2, 7)).toBe(0); // cart above stock (stock dropped)
    expect(remainingAddable(500, 99)).toBe(0);
    expect(remainingAddable(0, 0)).toBe(0);
    expect(remainingAddable(4, Number.NaN)).toBe(4);
  });
});
