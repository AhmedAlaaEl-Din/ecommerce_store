import { describe, expect, it } from "vitest";
import { pageWindow } from "@/components/ui/Pagination";
import { catalogHref, withChanges } from "@/lib/catalog-url";
import {
  addToCartSchema,
  cartIdSchema,
  catalogQuerySchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "@/lib/schemas";

describe("cart input schemas", () => {
  it("accepts a product id and defaults quantity to 1", () => {
    expect(addToCartSchema.parse({ productId: "cmabc123" })).toEqual({
      productId: "cmabc123",
      quantity: 1,
    });
  });

  it("coerces numeric strings", () => {
    expect(updateCartItemSchema.parse({ productId: "abc", quantity: "3" }).quantity).toBe(3);
  });

  it("rejects bad quantities", () => {
    for (const quantity of [0, -1, 1.5, 100, "x", null]) {
      expect(updateCartItemSchema.safeParse({ productId: "abc", quantity }).success).toBe(false);
    }
  });

  it("rejects bad product ids", () => {
    for (const productId of ["", "a".repeat(65), "abc'; DROP TABLE", "../x", 42, undefined]) {
      expect(removeCartItemSchema.safeParse({ productId }).success).toBe(false);
    }
  });

  it("ignores any price sent by the client", () => {
    const parsed = addToCartSchema.parse({ productId: "abc", quantity: 1, priceCents: 1 });
    expect(parsed).not.toHaveProperty("priceCents");
  });

  it("only accepts UUID cart ids", () => {
    expect(cartIdSchema.safeParse("3b241101-e2bb-4255-8caf-4136c566a962").success).toBe(true);
    expect(cartIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("catalogQuerySchema", () => {
  it("applies defaults", () => {
    expect(catalogQuerySchema.parse({})).toEqual({
      category: undefined,
      q: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("falls back instead of failing on bad values", () => {
    expect(
      catalogQuerySchema.parse({
        sort: "cheapest",
        page: "-4",
        category: "<script>",
        q: "x".repeat(200),
      }),
    ).toEqual({ category: undefined, q: undefined, sort: "newest", page: 1 });
  });

  it("normalises values and takes the first of repeated params", () => {
    expect(
      catalogQuerySchema.parse({
        category: ["Kitchen", "bags"],
        q: "  linen   cushion ",
        page: "2",
        sort: "price-desc",
      }),
    ).toEqual({ category: "kitchen", q: "linen cushion", sort: "price-desc", page: 2 });
  });
});

describe("catalog URLs", () => {
  it("omits defaults", () => {
    expect(catalogHref({})).toBe("/products");
    expect(catalogHref({ sort: "newest", page: 1 })).toBe("/products");
    expect(catalogHref({ category: "bags", q: "tote", sort: "price-asc", page: 2 })).toBe(
      "/products?category=bags&q=tote&sort=price-asc&page=2",
    );
  });

  it("resets to page 1 when a filter changes", () => {
    const current = catalogQuerySchema.parse({ category: "bags", page: "2" });
    expect(withChanges(current, { sort: "price-desc" })).toBe(
      "/products?category=bags&sort=price-desc",
    );
    expect(withChanges(current, { page: 2 })).toBe("/products?category=bags&page=2");
  });
});

describe("pageWindow", () => {
  it("shows all pages when there are few", () => {
    expect(pageWindow(1, 2)).toEqual([1, 2]);
  });
  it("collapses long ranges", () => {
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, "gap", 10]);
  });
});
