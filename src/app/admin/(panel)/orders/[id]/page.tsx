import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FulfilmentForm, NoteForm } from "@/components/admin/OrderForms";
import {
  DoneNotice,
  FulfilmentBadge,
  Notice,
  PageHeader,
  Panel,
  PaymentBadge,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { PrinterIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { fmtDateTime, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import {
  canCancel,
  checkRefund,
  FULFILMENT_LABELS,
  FULFILMENT_STEPS,
  maskReference,
  nextFulfilment,
  type FulfilmentStatus,
  type PaymentStatus,
} from "@/lib/admin/order-rules";
import { getOrderDetail } from "@/lib/admin/orders";
import { can } from "@/lib/admin/roles";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { countryName } from "@/lib/orders/checkout-schema";
import { cancelOrderAction, refundOrderAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order" };

const DONE = {
  packed: "Marked as packed.",
  shipped: "Marked as shipped. A “Your order has shipped” email was written to the outbox.",
  delivered: "Marked as delivered.",
  note: "Note added.",
  cancelled: "Order cancelled and its reserved stock released.",
  refunded: "Refund issued. A “Refund issued” email was written to the outbox.",
};

export default async function AdminOrderPage({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  const { user } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrderDetail(db, id);
  if (!order) notFound();
  const done = param(sp, "done");
  const status = order.status as PaymentStatus;
  const fulfilment = order.fulfilmentStatus as FulfilmentStatus;
  const next = status === "paid" ? nextFulfilment(fulfilment) : null;
  const money = (c: number) => formatMoney(c, order.currency);
  const refundCheck = checkRefund({ status, providerSessionId: order.providerSessionId, hasRefund: !!order.refund });
  const isAdmin = can(user.role, "orders.refund");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.orderNumber}
            <PaymentBadge status={order.status} />
            {(status === "paid" || status === "refunded") && <FulfilmentBadge status={order.fulfilmentStatus} />}
          </span>
        }
        description={`Placed ${fmtDateTime(order.createdAt)}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={
          <ButtonLink
            href={`/admin/orders/${order.id}/packing-slip`}
            variant="secondary"
            size="sm"
            icon={<PrinterIcon size={18} />}
            target="_blank"
            data-testid="packing-slip"
          >
            Packing slip
          </ButtonLink>
        }
      />
      <DoneNotice code={done} messages={DONE} />
      {done === "refund_failed" && <Notice tone="error">The refund didn’t go through. Nothing was changed.</Notice>}
      {done === "cancel_failed" && <Notice tone="error">This order can no longer be cancelled.</Notice>}
      {order.fulfilmentNote && (
        <Notice tone="error">
          Payment arrived after the reservation expired
          {order.fulfilmentNote === "paid_oversold" ? " and stock was short. Check stock before shipping." : "; stock was taken again."}
        </Notice>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Items" id="items" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Product</th>
                    <th scope="col" className={`${thClass} text-right`}>Qty</th>
                    <th scope="col" className={`${thClass} text-right`}>Unit price</th>
                    <th scope="col" className={`${thClass} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id} data-testid="order-line">
                      <td className={tdClass}>
                        <Link href={`/admin/products/${i.productId}`} className="font-medium underline-offset-2 hover:underline">
                          {i.productNameSnapshot}
                        </Link>
                        {i.product.archivedAt && <span className="text-muted ml-2 text-xs">(archived)</span>}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{i.quantity}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{money(i.unitPriceCentsSnapshot)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{money(i.lineTotalCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr>
                    <th scope="row" colSpan={3} className="px-3 pt-3 text-right font-normal text-muted">Subtotal</th>
                    <td className="px-3 pt-3 text-right tabular-nums">{money(order.subtotalCents)}</td>
                  </tr>
                  <tr>
                    <th scope="row" colSpan={3} className="px-3 pt-1 text-right font-normal text-muted">Shipping</th>
                    <td className="px-3 pt-1 text-right tabular-nums">{order.shippingCents === 0 ? "Free" : money(order.shippingCents)}</td>
                  </tr>
                  <tr>
                    <th scope="row" colSpan={3} className="px-3 pt-1 pb-3 text-right font-semibold">Total</th>
                    <td className="px-3 pt-1 pb-3 text-right font-semibold tabular-nums" data-testid="order-total">{money(order.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-muted border-line border-t px-3 py-2 text-xs">
              Names and prices are a snapshot from when the order was placed; later product edits don’t change them.
            </p>
          </Panel>

          <Panel title="Timeline" id="timeline">
            <ol className="flex flex-col gap-3" data-testid="timeline">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-hidden="true" />
                  <div>
                    <p>{e.message}</p>
                    <p className="text-muted text-xs">
                      {fmtDateTime(e.createdAt)}
                      {e.actor ? ` · ${e.actor.name}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {order.events.length === 0 && <li className="text-muted text-sm">No events recorded (order placed before Phase 3).</li>}
            </ol>
          </Panel>

          <Panel title="Internal notes" id="notes">
            <NoteForm orderId={order.id} />
            <ul className="divide-line mt-4 divide-y" data-testid="notes">
              {order.notes.map((n) => (
                <li key={n.id} className="py-3 text-sm">
                  {/* Rendered as text: React escapes it; no HTML from notes is ever interpreted. */}
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="text-muted mt-1 text-xs">
                    {n.author.name} · {fmtDateTime(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Fulfilment" id="fulfilment">
            {status === "paid" || status === "refunded" ? (
              <>
                <ol className="mb-4 grid grid-cols-4 gap-1" aria-label="Fulfilment progress">
                  {FULFILMENT_STEPS.map((s, i) => {
                    const reached = FULFILMENT_STEPS.indexOf(fulfilment) >= i;
                    return (
                      <li key={s} className="flex flex-col gap-1">
                        <span className={cn("h-1.5 rounded-full", reached ? "bg-primary" : "bg-line")} aria-hidden="true" />
                        <span className={cn("text-xs", reached ? "text-ink font-semibold" : "text-muted")}>
                          {FULFILMENT_LABELS[s]}
                          <span className="sr-only">{reached ? " (done)" : " (not yet)"}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {order.trackingNumber && (
                  <dl className="mb-4 grid grid-cols-[6rem_1fr] gap-y-1 text-sm" data-testid="tracking">
                    <dt className="text-muted">Carrier</dt>
                    <dd>{order.carrier}</dd>
                    <dt className="text-muted">Tracking</dt>
                    <dd className="break-all">{order.trackingNumber}</dd>
                  </dl>
                )}
                {next && can(user.role, "orders.fulfil") ? (
                  <FulfilmentForm orderId={order.id} next={next as Exclude<FulfilmentStatus, "unfulfilled">} />
                ) : (
                  <p className="text-muted text-sm">
                    {status === "refunded" ? "Refunded orders are not fulfilled further." : "Delivered. Nothing left to do."}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted text-sm">Only paid orders are fulfilled.</p>
            )}
          </Panel>

          <Panel title="Customer" id="customer">
            <p className="font-medium">{order.customerName}</p>
            <p className="text-sm break-all">{order.email}</p>
            <h3 className="text-muted mt-3 font-sans text-xs font-semibold tracking-[0.06em] uppercase">Ship to</h3>
            <address className="mt-1 text-sm not-italic">
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
          </Panel>

          <Panel title="Payment" id="payment">
            <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted">Provider</dt>
              <dd className="capitalize">{order.provider}</dd>
              <dt className="text-muted">Session</dt>
              <dd className="font-mono text-xs break-all" data-testid="masked-session">{maskReference(order.providerSessionId)}</dd>
              <dt className="text-muted">Paid</dt>
              <dd>{fmtDateTime(order.paidAt)}</dd>
              {order.refund && (
                <>
                  <dt className="text-muted">Refunded</dt>
                  <dd>
                    {money(order.refund.amountCents)} · {fmtDateTime(order.refund.createdAt)}
                    <span className="text-muted block font-mono text-xs">{maskReference(order.refund.providerRefundId)}</span>
                    <span className="text-muted block text-xs">{order.refund.restocked ? "Items restocked" : "Not restocked"}</span>
                  </dd>
                </>
              )}
            </dl>
            {isAdmin && (canCancel({ status }) || refundCheck.ok) && (
              <div className="border-line mt-4 flex flex-wrap gap-2 border-t pt-4">
                {canCancel({ status }) && (
                  <ConfirmDialog
                    testId="cancel-order"
                    triggerLabel="Cancel order"
                    title={`Cancel ${order.orderNumber}?`}
                    confirmLabel="Cancel order"
                    action={cancelOrderAction}
                    hidden={{ orderId: order.id }}
                  >
                    The order hasn’t been paid. Cancelling it releases the reserved stock and stops the payment session.
                  </ConfirmDialog>
                )}
                {refundCheck.ok && (
                  <ConfirmDialog
                    testId="refund-order"
                    triggerLabel="Refund"
                    title={`Refund ${money(order.totalCents)} for ${order.orderNumber}?`}
                    confirmLabel="Issue full refund"
                    action={refundOrderAction}
                    hidden={{ orderId: order.id }}
                  >
                    <p>
                      The full amount goes back through the {order.provider} provider. This can’t be undone. A “Refund issued” email is written to the outbox.
                    </p>
                    <label className="text-ink mt-3 flex min-h-11 items-center gap-2">
                      <input type="checkbox" name="restock" className="accent-primary size-4" data-testid="refund-restock" />
                      Put the items back in stock
                    </label>
                  </ConfirmDialog>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
