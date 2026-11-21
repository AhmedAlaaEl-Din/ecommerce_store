import Image from "next/image";
import Link from "next/link";
import { Badge } from "../ui/Badge";
import { Price } from "../ui/Price";
import { getSaleInfo, getStockStatus } from "@/lib/pricing";

export type ProductCardData = {
  slug: string;
  name: string;
  shortDescription: string;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  stock: number;
  imagePath: string;
  category: { name: string; accentColor: string };
};

export function ProductCard({
  product,
  priority = false,
  headingLevel = 3,
}: {
  product: ProductCardData;
  priority?: boolean;
  headingLevel?: 2 | 3;
}) {
  const sale = getSaleInfo(product.priceCents, product.compareAtCents);
  const stock = getStockStatus(product.stock);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex w-full flex-col" data-testid="product-card">
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ backgroundColor: product.category.accentColor }}
      >
        <Image
          src={product.imagePath}
          alt={`Illustration of the ${product.name}`}
          width={600}
          height={600}
          unoptimized
          priority={priority}
          className="aspect-square h-auto w-full transition-transform duration-200 ease-brand group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
        />
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {sale.onSale && stock !== "out" && <Badge tone="sale">Sale −{sale.percentOff}%</Badge>}
          {stock === "low" && <Badge tone="low">Only {product.stock} left</Badge>}
          {stock === "out" && <Badge tone="out">Out of stock</Badge>}
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          {product.category.name}
        </p>
        <Heading className="font-sans text-base leading-6 [text-wrap:pretty] font-semibold tracking-normal sm:text-lg sm:leading-7">
          <Link
            href={`/products/${product.slug}`}
            className="rounded-sm after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-primary"
          >
            {product.name}
          </Link>
        </Heading>
        <p className="line-clamp-2 hidden text-sm text-muted sm:block">{product.shortDescription}</p>
        <Price
          priceCents={product.priceCents}
          compareAtCents={product.compareAtCents}
          currency={product.currency}
          size="sm"
          className="mt-1"
        />
      </div>
    </article>
  );
}
