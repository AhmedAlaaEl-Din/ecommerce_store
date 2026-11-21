import type { Metadata } from "next";
import Link from "next/link";
import { CatalogControls } from "@/components/catalog/CatalogControls";
import { CatalogNavProvider, CatalogResults } from "@/components/catalog/CatalogPending";
import { ProductCard } from "@/components/product/ProductCard";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getCategories, searchProducts } from "@/lib/catalog";
import { catalogHref, SORT_LABELS } from "@/lib/catalog-url";
import { catalogQuerySchema, PAGE_SIZE } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Props = PageProps<"/products">;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = catalogQuerySchema.parse(await searchParams);
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === query.category);
  const title = query.q
    ? `Search: ${query.q}`
    : category
      ? `${category.name}`
      : "Shop all products";
  return {
    title,
    description: category
      ? `${category.description} Browse ${category.name.toLowerCase()} at Nile Goods (demo store).`
      : "Browse every Nile Goods product: ceramics, kitchen tools, stationery and bags. Demo store, no real orders.",
    alternates: { canonical: catalogHref({ category: query.category }) },
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const query = catalogQuerySchema.parse(await searchParams);
  const [categories, result] = await Promise.all([getCategories(), searchProducts(query)]);
  const category = categories.find((c) => c.slug === query.category);

  const crumbs: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/products" },
  ];
  if (category) crumbs.push({ label: category.name });

  const heading = query.q ? `Results for “${query.q}”` : category ? category.name : "All products";
  const from = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl">{heading}</h1>
        <p className="text-muted mt-2">
          {query.q
            ? category
              ? `Searching in ${category.name}.`
              : "Searching every product by name."
            : category
              ? category.description
              : "Everything in the shop: quiet pieces for the home, tools for the kitchen, paper for the desk and bags for the road."}
        </p>
      </div>

      <CatalogNavProvider>
        <div className="mt-8">
          <CatalogControls
            key={`${query.category ?? ""}|${query.sort}`}
            query={query}
            categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          />
        </div>

        <div className="border-line mt-6 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
          <p className="text-muted text-sm" aria-live="polite" data-testid="result-count">
            {result.total === 0
              ? "No products found"
              : result.total === 1
                ? "1 product"
                : result.totalPages > 1
                  ? `Showing ${from}–${to} of ${result.total} products`
                  : `${result.total} products`}
            {query.q ? (
              <>
                {" "}
                for “<span className="text-ink font-medium">{query.q}</span>”
              </>
            ) : null}
          </p>
          <p className="text-muted hidden text-sm md:block">
            Sorted by {SORT_LABELS[query.sort].toLowerCase()}
          </p>
        </div>

        <div className="mt-8">
          <CatalogResults skeletonCount={result.products.length}>
            {result.total === 0 ? (
              <EmptyState
                title="Nothing matches that, yet"
                testId="no-results"
                action={
                  <ButtonLink href="/products" variant="primary">
                    Reset filters
                  </ButtonLink>
                }
              >
                <p>
                  Try a shorter search or another category. Our edit is small but carefully chosen.
                </p>
                <ul
                  className="mt-4 flex flex-wrap justify-center gap-2"
                  aria-label="Browse a category"
                >
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={catalogHref({ category: c.slug })}
                        className="border-line-strong/60 text-ink hover:border-ink inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </EmptyState>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
                {result.products.map((p, i) => (
                  <li key={p.id} className="flex">
                    <ProductCard product={p} priority={i < 4} headingLevel={2} />
                  </li>
                ))}
              </ul>
            )}
          </CatalogResults>
        </div>

        <div className="mt-12">
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            hrefFor={(page) => catalogHref({ ...query, page })}
          />
        </div>
      </CatalogNavProvider>
    </div>
  );
}
