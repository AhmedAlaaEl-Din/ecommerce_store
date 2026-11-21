import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { fmtDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { countryName } from "@/lib/orders/checkout-schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Packing slip" };

/** Print-friendly packing slip: what is in the box and where it goes. No prices. */
export default async function PackingSlipPage({
  params,
}: PageProps<"/admin/orders/[id]/packing-slip">) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) notFound();
  const units = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div
      className="mx-auto max-w-2xl px-6 py-8 print:max-w-none print:p-0"
      data-testid="packing-slip-page"
    >
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/admin/orders/${order.id}`}
          className="text-primary text-sm font-medium underline underline-offset-2"
        >
          Back to the order
        </Link>
        <PrintButton />
      </div>
      <header className="border-ink flex items-start justify-between border-b-2 pb-4">
        <div>
          <p className="font-display text-2xl font-semibold">
            Nile <span className="text-accent italic">Goods</span>
          </p>
          <p className="text-muted text-sm">Demo store · packing slip</p>
        </div>
        <div className="text-right text-sm">
          <h1 className="font-sans text-lg font-semibold">{order.orderNumber}</h1>
          <p>Ordered {fmtDate(order.createdAt)}</p>
        </div>
      </header>
      <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <h2 className="text-muted font-sans text-xs font-semibold tracking-[0.08em] uppercase">
            Ship to
          </h2>
          <address className="mt-1 leading-6 not-italic">
            {order.customerName}
            <br />
            {order.addressLine1}
            {order.addressLine2 && (
              <>
                <br />
                {order.addressLine2}
              </>
            )}
            <br />
            {order.postalCode} {order.city}
            <br />
            {countryName(order.country)}
          </address>
        </div>
        <div>
          <h2 className="text-muted font-sans text-xs font-semibold tracking-[0.08em] uppercase">
            Shipping
          </h2>
          <p className="mt-1 leading-6">
            {order.carrier ? `${order.carrier}, ${order.trackingNumber}` : "Carrier not set yet"}
          </p>
        </div>
      </section>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-ink border-b text-left">
            <th scope="col" className="w-10 py-2">
              ✓
            </th>
            <th scope="col" className="py-2">
              Item
            </th>
            <th scope="col" className="py-2 text-right">
              Qty
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-line border-b">
              <td className="py-3">
                <span
                  className="border-ink inline-block size-4 rounded-sm border"
                  aria-hidden="true"
                />
              </td>
              <td className="py-3">{i.productNameSnapshot}</td>
              <td className="py-3 text-right tabular-nums">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <th scope="row" className="py-3 text-left font-semibold">
              Total units
            </th>
            <td className="py-3 text-right font-semibold tabular-nums">{units}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-muted mt-10 text-xs">
        Thank you for shopping with Nile Goods (an invented demo brand). Questions? Reply to your
        order email.
      </p>
    </div>
  );
}
