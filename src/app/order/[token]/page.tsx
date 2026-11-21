import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartCountSync } from "@/components/cart/CartCountSync";
import { AlertIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import { OrderStatusPoller } from "@/components/order/OrderStatusPoller";
import { ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { readCartId } from "@/lib/cart/cookie";
import { getCartItemCount } from "@/lib/cart/service";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { countryName } from "@/lib/orders/checkout-schema";
import { getOrderByToken, type OrderView } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

// Order pages hold personal data: never indexed, never cached, no referrer leaks.
export const metadata: Metadata = {
  title: "Your order",
  description: "Order status at Nile Goods (demo store).",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Props = PageProps<"/order/[token]">;

export default async function OrderPage({ params }: Props) {
  const { token } = await params;
  // Only the holder of the unguessable token can see this order (no ids in URLs).
  const order = await getOrderByToken(db, token);
  if (!order) notFound();

  const cartCount = order.status === "paid" ? await getCartItemCount(db, await readCartId()) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-4 sm:px-6 lg:pt-14">
      {cartCount !== null && <CartCountSync count={cartCount} />}
      {order.status === "paid" ? (
        <Paid order={order} />
      ) : order.status === "pending_payment" ? (
        <Pending order={order} />
      ) : (
        <NotCompleted order={order} />
      )}
    </div>
  );
}

function Pending({ order }: { order: OrderView }) {
  return (
    <section aria-labelledby="order-heading" data-testid="order-pending" aria-live="polite">
      <span className="bg-primary-soft text-primary inline-flex size-14 items-center justify-center rounded-full">
        <Spinner className="size-7" />
      </span>
      <h1 id="order-heading" className="mt-5 text-2xl sm:text-3xl">
        Confirming your payment…
      </h1>
      <p className="text-muted mt-2 max-w-prose">
        Thanks for your patience. We’re waiting for the payment provider to confirm order{" "}
        <strong className="text-ink">{order.orderNumber}</strong>. This usually takes a few seconds,
        and this page updates by itself.
      </p>
      <OrderStatusPoller />
    </section>
  );
}

function NotCompleted({ order }: { order: OrderView }) {
  const label =
    order.status === "payment_failed"
      ? "The payment didn’t go through"
      : order.status === "expired"
        ? "This checkout timed out"
        : "This checkout was cancelled";
  return (
    <section aria-labelledby="order-heading" data-testid="order-not-completed">
      <span className="bg-danger-soft text-danger inline-flex size-14 items-center justify-center rounded-full">
        <AlertIcon size={26} />
      </span>
      <h1 id="order-heading" className="mt-5 text-2xl sm:text-3xl">
        {label}
      </h1>
      <p className="text-muted mt-2 max-w-prose">
        Order {order.orderNumber} was not completed and nothing was charged. The items are back in
        stock for everyone, and your cart is unchanged.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/checkout?order=${order.publicToken}&status=${order.status}`} size="lg">
          Return to checkout
        </ButtonLink>
        <ButtonLink href="/cart" size="lg" variant="secondary">
          View cart
        </ButtonLink>
      </div>
    </section>
  );
}

function Paid({ order }: { order: OrderView }) {
  const m = (c: number) => formatMoney(c, order.currency);
  const firstName = order.customerName.split(" ")[0];
  return (
    <section aria-labelledby="order-heading" data-testid="order-paid">
      <span className="bg-primary-soft text-success inline-flex size-14 items-center justify-center rounded-full">
        <CheckIcon size={28} />
      </span>
      <p className="text-accent mt-5 text-xs font-semibold tracking-[0.12em] uppercase">
        Order confirmed
      </p>
      <h1 id="order-heading" className="mt-1 text-3xl sm:text-4xl">
        Thank you, {firstName}.
      </h1>
      <p className="text-muted mt-3 max-w-prose">
        Your order number is{" "}
        <strong className="text-ink tabular-nums" data-testid="order-number">
          {order.orderNumber}
        </strong>
        . We’ve written a confirmation to <span className="text-ink">{order.email}</span> (demo:
        saved as a local file, not sent).
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_15rem]">
        <section
          aria-labelledby="items-heading"
          className="border-line bg-surface rounded-xl border p-5 sm:p-6"
        >
          <h2 id="items-heading" className="font-sans text-base font-semibold tracking-normal">
            Items
          </h2>
          <ul className="divide-line mt-3 flex flex-col divide-y text-sm" data-testid="order-lines">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-2.5">
                <span>
                  {i.productNameSnapshot}{" "}
                  <span className="text-muted">
                    × {i.quantity} at {m(i.unitPriceCentsSnapshot)}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{m(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="border-line mt-3 flex flex-col gap-2 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{m(order.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="tabular-nums">
                {order.shippingCents === 0 ? "Free" : m(order.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between pt-1 text-base font-semibold">
              <dt>Total paid</dt>
              <dd className="tabular-nums" data-testid="order-total">
                {m(order.totalCents)}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="ship-heading"
          className="border-line bg-surface rounded-xl border p-5 sm:p-6"
        >
          <h2 id="ship-heading" className="font-sans text-base font-semibold tracking-normal">
            Shipping to
          </h2>
          <address
            className="text-muted mt-3 text-sm leading-relaxed not-italic"
            data-testid="order-address"
          >
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
        </section>
      </div>

      <div className="mt-8">
        <ButtonLink href="/products" size="lg">
          Continue shopping <ArrowRightIcon size={18} />
        </ButtonLink>
      </div>
    </section>
  );
}
