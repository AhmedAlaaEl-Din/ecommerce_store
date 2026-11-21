import Image from "next/image";
import { formatMoney } from "@/lib/money";

export type SummaryLine = {
  productId: string;
  name: string;
  imagePath: string;
  accentColor: string;
  quantity: number;
  lineTotalCents: number;
};

export type SummaryTotals = {
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
};

export function SummaryLines({ lines, currency }: { lines: SummaryLine[]; currency: string }) {
  return (
    <ul className="divide-line flex flex-col divide-y" data-testid="checkout-lines">
      {lines.map((l) => (
        <li key={l.productId} className="flex items-center gap-3 py-3 first:pt-0">
          <span
            className="relative size-14 shrink-0 overflow-hidden rounded-md"
            style={{ backgroundColor: l.accentColor }}
          >
            <Image
              src={l.imagePath}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="size-14"
            />
            <span className="bg-ink absolute -top-0 -right-0 flex size-5 items-center justify-center rounded-bl-md text-[11px] font-semibold text-white tabular-nums">
              {l.quantity}
            </span>
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">{l.name}</span>
            <span className="text-muted">Qty {l.quantity}</span>
          </span>
          <span className="text-sm font-medium tabular-nums">
            {formatMoney(l.lineTotalCents, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SummaryTotalsList({ totals }: { totals: SummaryTotals }) {
  const m = (c: number) => formatMoney(c, totals.currency);
  return (
    <dl className="border-line mt-4 flex flex-col gap-2.5 border-t pt-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted">
          Subtotal ({totals.itemCount} {totals.itemCount === 1 ? "item" : "items"})
        </dt>
        <dd className="font-medium tabular-nums" data-testid="checkout-subtotal">
          {m(totals.subtotalCents)}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Shipping</dt>
        <dd className="font-medium tabular-nums" data-testid="checkout-shipping">
          {totals.shippingCents === 0 ? "Free" : m(totals.shippingCents)}
        </dd>
      </div>
      <div className="border-line flex items-baseline justify-between border-t pt-3 text-base">
        <dt className="font-semibold">Total</dt>
        <dd className="text-xl font-semibold tabular-nums" data-testid="checkout-total">
          {m(totals.totalCents)}
        </dd>
      </div>
    </dl>
  );
}
