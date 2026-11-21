import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listOutbox } from "@/lib/orders/outbox";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dev outbox",
  description: "Order confirmation emails written to var/outbox (development only).",
  robots: { index: false, follow: false },
};

/** Development only: lists the confirmation "emails" written to var/outbox. */
export default async function OutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const entries = await listOutbox();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12">
      <p className="text-accent text-xs font-semibold tracking-[0.12em] uppercase">
        Development only
      </p>
      <h1 className="mt-1 text-2xl sm:text-3xl">Outbox</h1>
      <p className="text-muted mt-2 max-w-prose">
        Order confirmations are written as HTML files to <code>var/outbox/</code> instead of being
        sent. Nothing ever leaves this computer. This page is not available in production builds.
      </p>
      {entries.length === 0 ? (
        <p className="border-line bg-surface mt-8 rounded-xl border p-6" data-testid="outbox-empty">
          No emails yet. Place a test order to see one here.
        </p>
      ) : (
        <ul
          className="divide-line border-line bg-surface mt-8 divide-y rounded-xl border"
          data-testid="outbox-list"
        >
          {entries.map((e) => (
            <li key={e.name} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span>
                <span className="block font-medium">Order {e.orderNumber} confirmation</span>
                <span className="text-muted text-sm">
                  {e.modified.toISOString().replace("T", " ").slice(0, 19)} UTC ·{" "}
                  {(e.size / 1024).toFixed(1)} KB
                </span>
              </span>
              <a
                href={`/dev/outbox/${e.name}`}
                className="text-primary inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
              >
                Open email
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
