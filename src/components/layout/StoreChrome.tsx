import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { CartCountProvider } from "@/components/cart/CartCountProvider";
import { getCategories } from "@/lib/catalog";
import { readCartId } from "@/lib/cart/cookie";
import { getCartItemCount } from "@/lib/cart/service";
import { db } from "@/lib/db";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Storefront header, footer and cart count around a page. Used by the (store)
 * layout and by the root not-found page (which renders outside that layout).
 */
export async function StoreChrome({ children }: { children: ReactNode }) {
  // A database failure here must not take the whole page down: fall back to an
  // empty nav/cart and let the page itself show a friendly error if it also fails.
  const [categories, cartCount] = await Promise.all([
    getCategories().catch((err: unknown) => {
      unstable_rethrow(err); // let Next.js internal signals (dynamic usage, redirects) through
      console.error("[layout] categories failed:", err instanceof Error ? err.message : err);
      return [];
    }),
    readCartId()
      .then((id) => getCartItemCount(db, id))
      .catch((err: unknown) => {
        unstable_rethrow(err);
        console.error("[layout] cart count failed:", err instanceof Error ? err.message : err);
        return 0;
      }),
  ]);
  const nav = categories.map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <CartCountProvider initialCount={cartCount}>
      <SiteHeader categories={nav} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter categories={nav} />
    </CartCountProvider>
  );
}
