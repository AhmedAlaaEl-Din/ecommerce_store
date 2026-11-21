import { cn } from "@/lib/cn";

const STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

const INDEX: Record<string, number> = { unfulfilled: 0, packed: 1, shipped: 2, delivered: 3 };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Customer-facing fulfilment progress: a simple bar with four steps, and the
 * carrier and tracking number once the order has shipped.
 */
export function OrderProgress({
  order,
}: {
  order: {
    fulfilmentStatus: string;
    paidAt: Date | null;
    createdAt: Date;
    packedAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    carrier: string | null;
    trackingNumber: string | null;
  };
}) {
  const current = INDEX[order.fulfilmentStatus] ?? 0;
  const dates = [order.paidAt ?? order.createdAt, order.packedAt, order.shippedAt, order.deliveredAt];
  const label = STEPS[current]!.label;
  return (
    <section aria-labelledby="progress-heading" className="border-line bg-surface mt-8 rounded-xl border p-5 sm:p-6" data-testid="order-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="progress-heading" className="font-sans text-base font-semibold tracking-normal">
          Order status
        </h2>
        <p className="text-sm font-semibold" data-testid="fulfilment-status">
          {label}
        </p>
      </div>
      <div
        className="bg-sunken mt-4 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Order progress"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={current + 1}
        aria-valuetext={`${label} (step ${current + 1} of ${STEPS.length})`}
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${((current + 1) / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-2 text-xs sm:text-sm">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === current ? "step" : undefined} className={cn(i <= current ? "text-ink" : "text-muted")}>
            <span className={cn("block", i === current && "font-semibold")}>{s.label}</span>
            {i <= current && dates[i] && <span className="text-muted block">{dateFmt.format(dates[i]!)}</span>}
          </li>
        ))}
      </ol>
      {order.trackingNumber && (current >= 2) && (
        <dl className="border-line mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t pt-4 text-sm" data-testid="tracking-info">
          <dt className="text-muted">Carrier</dt>
          <dd>{order.carrier}</dd>
          <dt className="text-muted">Tracking number</dt>
          <dd className="font-medium break-all">{order.trackingNumber}</dd>
        </dl>
      )}
    </section>
  );
}
