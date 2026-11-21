import Link from "next/link";
import { ChevronLeftIcon, LockIcon } from "@/components/icons";
import { Wordmark } from "@/components/layout/Wordmark";

/**
 * Focused checkout layout (Phase 2 design review item, decided in Phase 3):
 * logo, a secure-checkout note and a way back to the cart, nothing else. Full
 * navigation and the footer are removed so the shopper's attention stays on
 * finishing the order, which is the common pattern in e-commerce checkouts.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-line bg-surface border-b" data-testid="checkout-header">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            href="/cart"
            className="text-ink/80 hover:text-ink inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            data-testid="back-to-cart"
          >
            <ChevronLeftIcon size={18} />
            <span>Back to cart</span>
          </Link>
          <Wordmark className="absolute left-1/2 -translate-x-1/2" />
          <p
            className="text-muted inline-flex items-center gap-1.5 text-sm"
            data-testid="secure-note"
          >
            <LockIcon size={16} className="text-success" />
            <span className="hidden sm:inline">Secure checkout</span>
            <span className="sm:hidden">Secure</span>
          </p>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <footer className="text-muted mx-auto w-full max-w-7xl px-4 py-8 text-center text-xs sm:px-6 lg:px-10">
        Nile Goods is a demo store. Payments are mock or Stripe test mode only; no real money moves.
      </footer>
    </>
  );
}
