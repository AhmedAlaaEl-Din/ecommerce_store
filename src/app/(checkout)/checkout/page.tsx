import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import {
  SummaryFootnote,
  SummaryLines,
  SummaryTotalsList,
} from "@/components/checkout/CheckoutSummary";
import { DemoRibbon } from "@/components/checkout/DemoRibbon";
import { AlertIcon, ChevronDownIcon, InfoIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { readCartId } from "@/lib/cart/cookie";
import { getCart } from "@/lib/cart/service";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import {
  COUNTRIES,
  EMPTY_CHECKOUT_VALUES,
  type CheckoutValues,
} from "@/lib/orders/checkout-schema";
import { getOrderByToken } from "@/lib/orders/service";
import { getPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Enter your contact and shipping details. Demo store: test payments only.",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/checkout">;

const NOTICES = {
  failed: {
    tone: "error",
    title: "Your payment was declined.",
    body: "Nothing was charged and your details are saved below. You can try the payment again.",
  },
  cancelled: {
    tone: "info",
    title: "Payment cancelled.",
    body: "Nothing was charged. Your details are saved below whenever you’re ready.",
  },
  expired: {
    tone: "info",
    title: "Your payment session timed out.",
    body: "Nothing was charged. Your details are saved below; try again when you’re ready.",
  },
} as const;

export default async function CheckoutPage({ searchParams }: Props) {
  const cartId = await readCartId();
  const cart = await getCart(db, cartId);
  const lines = cart.lines.filter((l) => !l.unavailable);
  if (lines.length === 0) redirect("/cart");

  // Coming back from a declined or cancelled payment: refill the form from that
  // order, but only in the browser (cart) that placed it.
  const sp = await searchParams;
  const token = typeof sp.order === "string" ? sp.order : "";
  let initialValues: CheckoutValues = EMPTY_CHECKOUT_VALUES;
  let notice: (typeof NOTICES)[keyof typeof NOTICES] | null = null;
  if (token) {
    const previous = await getOrderByToken(db, token);
    if (previous && cartId && previous.cartId === cartId && previous.status !== "paid") {
      initialValues = {
        email: previous.email,
        name: previous.customerName,
        addressLine1: previous.addressLine1,
        addressLine2: previous.addressLine2 ?? "",
        city: previous.city,
        postalCode: previous.postalCode,
        country: previous.country,
      };
      if (previous.status === "payment_failed") notice = NOTICES.failed;
      else if (previous.status === "cancelled") notice = NOTICES.cancelled;
      else if (previous.status === "expired") notice = NOTICES.expired;
    }
  }

  let mock = true;
  try {
    mock = getPayments().config.provider === "mock";
  } catch {
    // Misconfigured: the action reports it on submit; instrumentation already logged it.
  }

  const currency = lines[0]!.currency;
  const total = formatMoney(cart.totalCents, currency);
  const summaryLines = lines.map((l) => ({
    productId: l.productId,
    name: l.name,
    imagePath: l.imagePath,
    accentColor: l.accentColor,
    quantity: l.quantity,
    lineTotalCents: l.lineTotalCents,
  }));
  const totals = {
    itemCount: cart.itemCount,
    subtotalCents: cart.subtotalCents,
    shippingCents: cart.shippingCents,
    totalCents: cart.totalCents,
    savingsCents: lines.reduce(
      (sum, l) =>
        l.compareAtCents != null && l.compareAtCents > l.priceCents
          ? sum + (l.compareAtCents - l.priceCents) * l.quantity
          : sum,
      0,
    ),
    currency,
  };

  return (
    <>
      {mock && <DemoRibbon />}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Cart", href: "/cart" },
            { label: "Checkout" },
          ]}
        />
        <h1 className="mt-4 text-2xl sm:text-3xl">Checkout</h1>

        {notice && (
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            data-testid="checkout-notice"
            className={
              notice.tone === "error"
                ? "border-danger/40 bg-danger-soft mt-6 flex gap-3 rounded-lg border p-4"
                : "border-line bg-surface mt-6 flex gap-3 rounded-lg border p-4"
            }
          >
            {notice.tone === "error" ? (
              <AlertIcon size={20} className="text-danger mt-0.5 shrink-0" />
            ) : (
              <InfoIcon size={20} className="text-primary mt-0.5 shrink-0" />
            )}
            <p className="text-sm">
              <strong className="block text-base">{notice.title}</strong>
              {notice.body}
            </p>
          </div>
        )}

        <div className="mt-6 grid items-start gap-8 lg:mt-8 lg:grid-cols-[1fr_24rem] lg:gap-14">
          {/* Mobile: collapsible summary on top. */}
          <details
            className="border-line bg-surface group rounded-xl border lg:hidden"
            data-testid="mobile-summary"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="text-primary flex items-center gap-2 text-sm font-semibold">
                <span className="group-open:hidden">Show order summary</span>
                <span className="hidden group-open:inline">Hide order summary</span>
                <ChevronDownIcon
                  size={18}
                  className="ease-brand transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                />
              </span>
              <span className="text-lg font-semibold tabular-nums">{total}</span>
            </summary>
            <div className="border-line border-t px-4 pt-4 pb-4">
              <SummaryLines lines={summaryLines} currency={currency} />
              <SummaryTotalsList totals={totals} />
              <SummaryFootnote />
            </div>
          </details>

          <section aria-label="Your details">
            <CheckoutForm
              initialValues={initialValues}
              countries={COUNTRIES}
              totalLabel={total}
              retry={notice !== null}
              providerNote={
                mock
                  ? "Next: the mock payment page (demo). No card details are needed."
                  : "Next: Stripe’s secure checkout page in test mode. Use a Stripe test card."
              }
            />
          </section>

          <aside
            aria-labelledby="checkout-summary-heading"
            className="border-line bg-surface shadow-1 hidden rounded-xl border p-6 lg:sticky lg:top-24 lg:block"
            data-testid="checkout-summary"
          >
            <h2 id="checkout-summary-heading" className="mb-4 text-xl">
              Order summary
            </h2>
            <SummaryLines lines={summaryLines} currency={currency} />
            <SummaryTotalsList totals={totals} />
            <SummaryFootnote />
          </aside>
        </div>
      </div>
    </>
  );
}
