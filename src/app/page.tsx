import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, ReturnIcon, ShieldIcon, TruckIcon } from "@/components/icons";
import { ProductCard } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { getCategoriesWithCounts, getFeaturedProducts, getSaleProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featured, sale] = await Promise.all([
    getCategoriesWithCounts(),
    getFeaturedProducts(4),
    getSaleProducts(4),
  ]);

  return (
    <>
      <Hero />

      <section
        aria-labelledby="categories-heading"
        className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:mt-28 lg:px-10"
      >
        <SectionHeader eyebrow="Browse" title="Shop by room and ritual" id="categories-heading" />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/products?category=${c.slug}`}
                className="group ease-brand hover:shadow-2 relative flex h-full flex-col overflow-hidden rounded-lg p-4 transition-shadow duration-200 sm:p-5"
                style={{ backgroundColor: c.accentColor }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl">{c.name}</h3>
                    <p className="text-ink/75 text-sm">{c.productCount} products</p>
                  </div>
                  <span className="bg-surface/70 ease-brand hidden size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5 sm:inline-flex">
                    <ArrowRightIcon size={18} />
                  </span>
                </div>
                {c.coverImage && (
                  <Image
                    src={c.coverImage}
                    alt=""
                    width={600}
                    height={600}
                    unoptimized
                    className="ease-brand mx-auto mt-2 aspect-square w-full max-w-56 transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                  />
                )}
                <p className="text-ink/80 mt-2 hidden text-sm sm:block">{c.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ProductRow
        id="featured-heading"
        eyebrow="Featured"
        title="Chosen for everyday use"
        href="/products"
        linkLabel="Shop all products"
        products={featured}
        testId="featured-row"
      />

      <TrustStrip />

      {sale.length > 0 && (
        <ProductRow
          id="sale-heading"
          eyebrow="On sale"
          title="A little less, for a little while"
          href="/products?sort=price-asc"
          linkLabel="Browse by price"
          products={sale}
          testId="sale-row"
        />
      )}
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-10 lg:pt-14">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="max-w-xl">
          <p className="text-accent text-xs font-semibold tracking-[0.12em] uppercase">
            The autumn edit · New in
          </p>
          <h1 className="mt-4 text-[2.5rem] leading-[1.08] sm:text-3xl sm:leading-[1.1] lg:text-[3.5rem]">
            Well-made things for slow, everyday living
          </h1>
          <p className="text-muted mt-5 text-lg">
            Ceramics, linen, paper and bags from small workshops, chosen to be used every day and
            kept for years.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/products" size="lg" icon={null}>
              Shop the collection
              <ArrowRightIcon size={18} />
            </ButtonLink>
            <ButtonLink href="/products?category=kitchen" size="lg" variant="secondary">
              Explore the kitchen
            </ButtonLink>
          </div>
        </div>

        <HeroArt />
      </div>
    </section>
  );
}

function HeroArt() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="grid aspect-[5/4] grid-cols-[1.25fr_1fr] grid-rows-2 gap-3 sm:gap-4">
        <div className="row-span-2 overflow-hidden rounded-xl bg-[#E8D9C4]">
          <Image
            src="/products/dune-ceramic-vase.svg"
            alt=""
            width={600}
            height={600}
            unoptimized
            priority
            className="h-full w-full object-cover"
          />
        </div>
        <div className="overflow-hidden rounded-xl bg-[#D9E4D6]">
          <Image
            src="/products/basalt-stoneware-mug.svg"
            alt=""
            width={600}
            height={600}
            unoptimized
            priority
            className="h-full w-full object-cover"
          />
        </div>
        <div className="overflow-hidden rounded-xl bg-[#E4DCEB]">
          <Image
            src="/products/scribe-linen-notebook.svg"
            alt=""
            width={600}
            height={600}
            unoptimized
            priority
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <div className="border-line bg-surface shadow-2 absolute -bottom-5 left-4 flex items-center gap-3 rounded-lg border px-4 py-3 sm:left-6">
        <span className="bg-accent-soft text-accent inline-flex size-9 items-center justify-center rounded-full">
          <span className="font-display text-lg leading-none">24</span>
        </span>
        <span className="text-sm">
          <span className="block font-semibold">Pieces in the edit</span>
          <span className="text-muted">Made in small batches</span>
        </span>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  id,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  id: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <p className="text-accent text-xs font-semibold tracking-[0.12em] uppercase">{eyebrow}</p>
        <h2 id={id} className="mt-2 text-xl sm:text-2xl">
          {title}
        </h2>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="text-primary inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
        >
          {linkLabel}
          <ArrowRightIcon size={16} />
        </Link>
      )}
    </div>
  );
}

function ProductRow({
  id,
  eyebrow,
  title,
  href,
  linkLabel,
  products,
  testId,
}: {
  id: string;
  eyebrow: string;
  title: string;
  href: string;
  linkLabel: string;
  products: Parameters<typeof ProductCard>[0]["product"][];
  testId: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:mt-28 lg:px-10"
      data-testid={testId}
    >
      <SectionHeader eyebrow={eyebrow} title={title} id={id} href={href} linkLabel={linkLabel} />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: <TruckIcon size={22} />, title: "Free shipping over $50", text: "Flat $6 below that." },
    {
      icon: <ReturnIcon size={22} />,
      title: "30-day returns",
      text: "Changed your mind? Send it back.",
    },
    {
      icon: <ShieldIcon size={22} />,
      title: "Secure checkout",
      text: "Encrypted, card details never stored.",
    },
  ];
  return (
    <section
      aria-label="Our promises"
      className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:mt-28 lg:px-10"
    >
      <ul className="border-line bg-line grid gap-px overflow-hidden rounded-xl border sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.title} className="bg-surface flex items-center gap-4 px-5 py-5 sm:px-6">
            <span className="bg-primary-soft text-primary inline-flex size-11 shrink-0 items-center justify-center rounded-full">
              {i.icon}
            </span>
            <span>
              <span className="block font-semibold">{i.title}</span>
              <span className="text-muted text-sm">{i.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
