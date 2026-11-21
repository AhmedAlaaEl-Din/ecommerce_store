import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed";
import { categories, products } from "../../prisma/seed-data";
import {
  getFeaturedProducts,
  getProductBySlug,
  getSaleProducts,
  searchProducts,
} from "@/lib/catalog";
import { catalogQuerySchema } from "@/lib/schemas";
import { resetDb, testDb } from "./helpers";

const db = testDb();
const q = (input: Record<string, string>) => catalogQuerySchema.parse(input);

beforeAll(async () => {
  await resetDb(db);
  await seedDatabase(db);
});

afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

describe("seed", () => {
  it("is idempotent", async () => {
    await seedDatabase(db);
    await seedDatabase(db);
    expect(await db.category.count()).toBe(categories.length);
    expect(await db.product.count()).toBe(products.length);
  });

  it("meets the demo data rules", async () => {
    expect(await db.product.count()).toBe(24);
    expect(await db.category.count()).toBe(4);
    expect(await db.product.count({ where: { stock: 0 } })).toBeGreaterThanOrEqual(2);
    expect(await db.product.count({ where: { stock: { in: [1, 2] } } })).toBeGreaterThanOrEqual(2);
    const sale = await db.product.findMany({ where: { compareAtCents: { not: null } } });
    expect(sale.filter((p) => p.compareAtCents! > p.priceCents).length).toBeGreaterThanOrEqual(4);
  });
});

describe("searchProducts", () => {
  it("returns 12 per page with the total", async () => {
    const page1 = await searchProducts(q({}), db);
    expect(page1.products).toHaveLength(12);
    expect(page1.total).toBe(24);
    expect(page1.totalPages).toBe(2);
    const page2 = await searchProducts(q({ page: "2" }), db);
    expect(page2.products).toHaveLength(12);
    const ids = new Set([...page1.products, ...page2.products].map((p) => p.id));
    expect(ids.size).toBe(24);
  });

  it("clamps an out-of-range page to the last page", async () => {
    const r = await searchProducts(q({ page: "99" }), db);
    expect(r.page).toBe(2);
  });

  it("filters by category", async () => {
    const r = await searchProducts(q({ category: "kitchen" }), db);
    expect(r.total).toBe(6);
    expect(r.products.every((p) => p.category.slug === "kitchen")).toBe(true);
  });

  it("searches by name, case-insensitively", async () => {
    const r = await searchProducts(q({ q: "VASE" }), db);
    expect(r.products.map((p) => p.slug)).toEqual(["dune-ceramic-vase"]);
  });

  it("sorts by price both ways and by newest", async () => {
    const asc = (await searchProducts(q({ sort: "price-asc" }), db)).products.map(
      (p) => p.priceCents,
    );
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await searchProducts(q({ sort: "price-desc" }), db)).products.map(
      (p) => p.priceCents,
    );
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const newest = (await searchProducts(q({}), db)).products[0];
    expect(newest.slug).toBe("nomad-roll-top-backpack");
  });

  it("treats LIKE wildcards in the search box literally", async () => {
    expect((await searchProducts(q({ q: "%" }), db)).total).toBe(0);
    expect((await searchProducts(q({ q: "_" }), db)).total).toBe(0);
  });

  it("hides inactive products", async () => {
    await db.product.update({ where: { slug: "dune-ceramic-vase" }, data: { isActive: false } });
    expect((await searchProducts(q({ q: "vase" }), db)).total).toBe(0);
    expect(await getProductBySlug("dune-ceramic-vase", db)).toBeNull();
    await db.product.update({ where: { slug: "dune-ceramic-vase" }, data: { isActive: true } });
    expect(await getProductBySlug("dune-ceramic-vase", db)).not.toBeNull();
  });

  it("returns null for unknown or malformed slugs", async () => {
    expect(await getProductBySlug("no-such-thing", db)).toBeNull();
    expect(await getProductBySlug("../etc/passwd", db)).toBeNull();
  });
});

describe("home rows", () => {
  it("featured excludes sale and out-of-stock items; sale row only has real discounts", async () => {
    const featured = await getFeaturedProducts(8, db);
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((p) => p.stock > 0 && p.compareAtCents === null)).toBe(true);
    const sale = await getSaleProducts(8, db);
    expect(sale.length).toBe(4);
    expect(sale.every((p) => p.compareAtCents! > p.priceCents)).toBe(true);
  });
});
