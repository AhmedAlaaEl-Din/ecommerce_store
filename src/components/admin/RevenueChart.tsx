import { formatMoney } from "@/lib/money";
import type { DayRevenue } from "@/lib/admin/dashboard";

const W = 1040;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

function niceMax(v: number): number {
  if (v <= 0) return 10_000; // $100
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Revenue by day as a plain SVG bar chart (server-rendered, no chart library).
 * The SVG has a text summary for screen readers; the exact numbers are in the
 * table under "Show as a table".
 */
export function RevenueChart({ days, currency }: { days: DayRevenue[]; currency: string }) {
  const max = niceMax(Math.max(...days.map((d) => d.revenueCents)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / days.length;
  const barW = Math.max(4, slot * 0.66);
  const total = days.reduce((s, d) => s + d.revenueCents, 0);
  const best = days.reduce((a, b) => (b.revenueCents > a.revenueCents ? b : a), days[0]!);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const summary = `Revenue for the last ${days.length} days: ${formatMoney(total, currency)} in total. Best day ${shortDay(best.day)} with ${formatMoney(best.revenueCents, currency)}.`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-labelledby="revenue-chart-title revenue-chart-desc"
        data-testid="revenue-chart"
      >
        <title id="revenue-chart-title">Revenue by day, last {days.length} days</title>
        <desc id="revenue-chart-desc">{summary}</desc>
        {ticks.map((t) => {
          const y = PAD.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                {formatMoney(t, currency).replace(/\.00$/, "")}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const h = (d.revenueCents / max) * innerH;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = PAD.top + innerH - h;
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx={2} fill="var(--primary)">
                <title>{`${shortDay(d.day)}: ${formatMoney(d.revenueCents, currency)} (${d.orders} order${d.orders === 1 ? "" : "s"})`}</title>
              </rect>
              {(i % 5 === 0 || i === days.length - 1) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  {shortDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
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
                <th scope="col" className="py-1 pr-4">Day (UTC)</th>
                <th scope="col" className="py-1 pr-4 text-right">Paid orders</th>
                <th scope="col" className="py-1 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-line border-t">
                  <th scope="row" className="py-1 pr-4 text-left font-normal">{d.day}</th>
                  <td className="py-1 pr-4 text-right tabular-nums">{d.orders}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(d.revenueCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
