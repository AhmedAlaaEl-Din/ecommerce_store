import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, LeafIcon, ReturnIcon, TruckIcon } from "@/components/icons";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductCard } from "@/components/product/ProductCard";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Price } from "@/components/ui/Price";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { getSaleInfo, getStockStatus } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type Props = PageProps<"/products/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const description = `${product.shortDescription} ${formatMoney(product.priceCents)} at Nile Goods (demo store).`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} · Nile Goods`,
      description,
      url: `/products/${product.slug}`,
      images: [
        {
          url: product.imagePath,
          width: 600,
          height: 600,
          alt: `Illustration of the ${product.name}`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${product.name} · Nile Goods`,
      description,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product.id, product.categoryId, 4);
  const stock = getStockStatus(product.stock);
  const sale = getSaleInfo(product.priceCents, product.compareAtCents);

  const benefits = [
    { icon: <TruckIcon size={20} />, text: "Free shipping on orders over $50" },
    { icon: <ReturnIcon size={20} />, text: "30-day returns, no questions asked" },
    { icon: <LeafIcon size={20} />, text: "Made in small batches to last for years" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/products" },
          { label: product.category.name, href: `/products?category=${product.category.slug}` },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-2 lg:gap-16">
        <div
          className="relative self-start overflow-hidden rounded-xl"
          style={{ backgroundColor: product.category.accentColor }}
        >
          <Image
            src={product.imagePath}
            alt={`Illustration of the ${product.name}`}
            width={600}
            height={600}
            unoptimized
            loading="eager"
            fetchPriority="high"
            className="aspect-square h-auto w-full"
          />
          {sale.onSale && stock !== "out" && (
            <Badge tone="sale" className="absolute top-4 left-4">
              Sale −{sale.percentOff}%
            </Badge>
          )}
        </div>

        <div className="flex flex-col lg:py-4">
          <Link
            href={`/products?category=${product.category.slug}`}
            className="text-accent inline-flex min-h-11 items-center self-start text-xs font-semibold tracking-[0.12em] uppercase underline-offset-4 hover:underline sm:min-h-6"
          >
            {product.category.name}
          </Link>
          <h1 className="mt-1 text-2xl sm:text-3xl">{product.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Price
              priceCents={product.priceCents}
              compareAtCents={product.compareAtCents}
              currency={product.currency}
              size="lg"
            />
            <span data-testid="stock-badge">
              {stock === "out" && <Badge tone="out">Out of stock</Badge>}
              {stock === "low" && <Badge tone="low">Only {product.stock} left</Badge>}
              {stock === "in" && (
                <span className="text-success inline-flex items-center gap-1 text-sm font-medium">
                  <CheckIcon size={16} /> In stock
                </span>
              )}
            </span>
          </div>
          {sale.onSale && (
            <p className="text-accent mt-1 text-sm">You save {formatMoney(sale.savingsCents)}</p>
          )}

          <p className="mt-6 text-lg">{product.shortDescription}</p>

          <div className="mt-8">
            <AddToCart productId={product.id} productName={product.name} stock={product.stock} />
          </div>

          <ul className="border-line mt-8 flex flex-col gap-3 border-t pt-6">
            {benefits.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-sm">
                <span className="bg-primary-soft text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-full">
                  {b.icon}
                </span>
                {b.text}
              </li>
            ))}
          </ul>

          <section aria-labelledby="details-heading" className="border-line mt-8 border-t pt-6">
            <h2 id="details-heading" className="font-sans text-base font-semibold tracking-normal">
              Details
            </h2>
            <p className="text-muted mt-2">{product.description}</p>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-20 lg:mt-28" data-testid="related">
          <p className="text-accent text-xs font-semibold tracking-[0.12em] uppercase">
            More from {product.category.name}
          </p>
          <h2 id="related-heading" className="mt-2 text-xl sm:text-2xl">
            You may also like
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
            {related.map((p) => (
              <li key={p.id} className="flex">
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
