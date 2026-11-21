import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { mockDeclineAction, mockPayAction } from "@/app/mock-pay/actions";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/Button";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getPayments } from "@/lib/payments";
import { isMockAllowed } from "@/lib/payments/config";
import { MOCK_SESSION_ID_RE } from "@/lib/payments/mock";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mock payment",
  description: "Mock payment page for the Nile Goods demo. No real payment provider is used.",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/mock-pay/[sessionId]">;

const ERRORS: Record<string, string> = {
  busy: "Too many attempts in a short time. Please wait a moment and try again.",
  webhook: "The mock payment could not be recorded. Please try again.",
};

export default async function MockPayPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  if (!MOCK_SESSION_ID_RE.test(sessionId) || !isMockAllowed()) notFound();
  let provider: string;
  try {
    provider = getPayments().config.provider;
  } catch {
    notFound();
  }
  if (provider !== "mock") notFound();

  const order = await db.order.findUnique({
    where: { providerSessionId: sessionId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order || order.provider !== "mock") notFound();
  if (order.status === "paid") redirect(`/order/${order.publicToken}`);
  if (order.status !== "pending_payment") {
    redirect(`/checkout?order=${order.publicToken}&status=${order.status}`);
  }

  const errorKey = (await searchParams).error;
  const error = typeof errorKey === "string" ? ERRORS[errorKey] : undefined;
  const m = (c: number) => formatMoney(c, order.currency);
  const cancelHref = `/checkout/cancel?order=${order.publicToken}`;

  return (
    <div>
      <p
        className="bg-ink px-4 py-3 text-center text-sm font-semibold text-white"
        data-testid="mock-banner"
      >
        Mock payment page. No real payment provider is used.
      </p>

      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <section
          aria-labelledby="mock-pay-heading"
          className="border-line bg-surface shadow-2 rounded-xl border p-6 sm:p-8"
        >
          <p className="text-muted text-xs font-semibold tracking-[0.12em] uppercase">
            Pay Nile Goods (demo)
          </p>
          <h1
            id="mock-pay-heading"
            className="mt-1 text-3xl tabular-nums"
            data-testid="mock-amount"
          >
            {m(order.totalCents)}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Order <span className="text-ink font-medium">{order.orderNumber}</span>
          </p>

          <ul className="border-line mt-6 flex flex-col gap-2 border-t pt-4 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4">
                <span>
                  {i.productNameSnapshot} <span className="text-muted">× {i.quantity}</span>
                </span>
                <span className="tabular-nums">{m(i.lineTotalCents)}</span>
              </li>
            ))}
            <li className="text-muted flex justify-between gap-4">
              <span>Shipping</span>
              <span className="tabular-nums">
                {order.shippingCents === 0 ? "Free" : m(order.shippingCents)}
              </span>
            </li>
          </ul>

          <p className="bg-background mt-6 flex gap-2 rounded-lg p-3 text-sm">
            <InfoIcon size={18} className="text-primary mt-0.5 shrink-0" />
            Choose an outcome to test. Nothing is charged and no card is needed.
          </p>

          {error && (
            <p
              role="alert"
              className="border-danger/40 bg-danger-soft mt-4 flex gap-2 rounded-lg border p-3 text-sm"
            >
              <AlertIcon size={18} className="text-danger mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <form action={mockPayAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <Button
                type="submit"
                size="lg"
                fullWidth
                icon={<CheckIcon size={18} />}
                data-testid="mock-pay"
              >
                Pay {m(order.totalCents)} (test success)
              </Button>
            </form>
            <form action={mockDeclineAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <Button
                type="submit"
                size="lg"
                variant="secondary"
                fullWidth
                icon={<AlertIcon size={18} />}
                data-testid="mock-decline"
              >
                Decline (test failure)
              </Button>
            </form>
            {/* Plain <a>: a full GET to the cancel route (Stripe's cancel_url), no prefetch. */}
            <a
              href={cancelHref}
              className={buttonClasses({ variant: "ghost", size: "lg", fullWidth: true })}
              data-testid="mock-cancel"
            >
              <CloseIcon size={18} />
              Cancel and return to checkout
            </a>
          </div>
        </section>
        <p className="text-muted mt-4 text-center text-xs">
          Demo only: a real store would show a secure card form here (Stripe Checkout in test mode).
        </p>
      </div>
    </div>
  );
}
