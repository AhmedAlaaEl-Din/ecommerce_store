import { formatMoney } from "@/lib/money";
import { getSaleInfo } from "@/lib/pricing";
import { cn } from "@/lib/cn";

type PriceProps = {
  priceCents: number;
  compareAtCents?: number | null;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { now: "text-base", was: "text-sm" },
  md: { now: "text-lg", was: "text-sm" },
  lg: { now: "text-2xl font-display", was: "text-lg" },
};

/** Price with sale display: accent current price and struck-through compare-at price. */
export function Price({
  priceCents,
  compareAtCents,
  currency = "USD",
  size = "md",
  className,
}: PriceProps) {
  const sale = getSaleInfo(priceCents, compareAtCents);
  const now = formatMoney(priceCents, currency);
  if (!sale.onSale) {
    return (
      <p className={cn("font-semibold tabular-nums", sizes[size].now, className)} data-testid="price">
        {now}
      </p>
    );
  }
  const was = formatMoney(sale.compareAtCents, currency);
  return (
    <p
      className={cn("flex flex-wrap items-baseline gap-x-2 tabular-nums", className)}
      data-testid="price"
    >
      <span className="sr-only">
        Sale price {now}, was {was}.
      </span>
      <span aria-hidden="true" className={cn("font-semibold text-accent", sizes[size].now)}>
        {now}
      </span>
      <s aria-hidden="true" className={cn("text-muted", sizes[size].was)}>
        {was}
      </s>
    </p>
  );
}
