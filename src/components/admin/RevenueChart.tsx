import { formatMoney } from "@/lib/money";
import type { DayRevenue } from "@/lib/admin/dashboard";

function niceMax(v: number): number {
  if (v <= 0) return 10_000; // $100
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Revenue by day as a plain SVG bar chart (server-rendered, no chart library).
 * The SVG has a text summary for screen readers; the exact numbers are in the
 * table under "Show as a table".
 */
type Variant = {
  id: string;
  W: number;
  H: number;
  pad: { top: number; right: number; bottom: number; left: number };
  font: number;
  labelEvery: number;
  className: string;
};

// Two drawings of the same data, each scaled to its container (viewBox +
// width 100%, no min-width, no scrolling). The compact one is drawn at roughly
// phone width so its text stays readable (11px at 390px wide) and all bars fit;
// CSS shows exactly one of them.
const COMPACT: Variant = {
  id: "compact",
  W: 340,
  H: 240,
  pad: { top: 12, right: 4, bottom: 28, left: 46 },
  font: 11,
  labelEvery: 7,
  className: "block h-auto w-full sm:hidden",
};
const WIDE: Variant = {
  id: "wide",
  W: 800,
  H: 260,
  pad: { top: 12, right: 8, bottom: 30, left: 60 },
  font: 12,
  labelEvery: 5,
  className: "hidden h-auto w-full sm:block",
};

function Chart({
  v,
  days,
  currency,
  summary,
}: {
  v: Variant;
  days: DayRevenue[];
  currency: string;
  summary: string;
}) {
  const { W, H, pad, font } = v;
  const max = niceMax(Math.max(...days.map((d) => d.revenueCents)));
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / days.length;
  const barW = Math.max(4, slot * 0.66);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const titleId = `revenue-chart-title-${v.id}`;
  const descId = `revenue-chart-desc-${v.id}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className={v.className}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      data-testid={`revenue-chart-${v.id}`}
    >
      <title id={titleId}>{`Revenue by day, last ${days.length} days`}</title>
      <desc id={descId}>{summary}</desc>
      {ticks.map((t) => {
        const y = pad.top + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={font} fill="var(--muted)">
              {formatMoney(t, currency).replace(/\.00$/, "")}
            </text>
          </g>
        );
      })}
      {days.map((d, i) => {
        const h = (d.revenueCents / max) * innerH;
        const x = pad.left + i * slot + (slot - barW) / 2;
        const y = pad.top + innerH - h;
        // Thin the x labels; skip the last one if it would crowd the previous.
        const showLabel =
          i % v.labelEvery === 0 ||
          (i === days.length - 1 && (days.length - 1) % v.labelEvery >= 4);
        return (
          <g key={d.day}>
            <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx={2} fill="var(--primary)">
              <title>{`${shortDay(d.day)}: ${formatMoney(d.revenueCents, currency)} (${d.orders} order${d.orders === 1 ? "" : "s"})`}</title>
            </rect>
            {showLabel && (
              <text
                x={Math.min(x + barW / 2, W - 16)}
                y={H - 8}
                textAnchor="middle"
                fontSize={font}
                fill="var(--muted)"
              >
                {shortDay(d.day)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Revenue by day as a plain SVG bar chart (server-rendered, no chart library).
 * The SVG has a text summary for screen readers; the exact numbers are in the
 * table under "Show as a table".
 */
export function RevenueChart({ days, currency }: { days: DayRevenue[]; currency: string }) {
  const total = days.reduce((s, d) => s + d.revenueCents, 0);
  const best = days.reduce((a, b) => (b.revenueCents > a.revenueCents ? b : a), days[0]!);
  const summary = `Revenue for the last ${days.length} days: ${formatMoney(total, currency)} in total. Best day ${shortDay(best.day)} with ${formatMoney(best.revenueCents, currency)}.`;

  return (
    <figure>
      <div data-testid="revenue-chart-scroll">
        <Chart v={COMPACT} days={days} currency={currency} summary={summary} />
        <Chart v={WIDE} days={days} currency={currency} summary={summary} />
      </div>
      <figcaption className="text-muted mt-2 text-xs">{summary}</figcaption>
      <details className="mt-3 text-sm">
        <summary className="text-primary inline-flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-4 lg:min-h-8">
          Show as a table
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-sm" data-testid="revenue-table">
            <caption className="sr-only">Revenue by day</caption>
            <thead>
              <tr className="text-muted text-left text-xs uppercase">
                <th scope="col" className="py-1 pr-4">
                  Day (UTC)
                </th>
                <th scope="col" className="py-1 pr-4 text-right">
                  Paid orders
                </th>
                <th scope="col" className="py-1 text-right">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-line border-t">
                  <th scope="row" className="py-1 pr-4 text-left font-normal">
                    {d.day}
                  </th>
                  <td className="py-1 pr-4 text-right tabular-nums">{d.orders}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(d.revenueCents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
