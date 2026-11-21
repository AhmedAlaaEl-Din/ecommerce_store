import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { readCartId } from "@/lib/cart/cookie";
import { getCart } from "@/lib/cart/service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review the items in your Nile Goods cart. Demo store: checkout arrives in Phase 2.",
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const cart = await getCart(db, await readCartId());
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <h1 className="mt-4 text-2xl sm:text-3xl">Your cart</h1>
      {/* key: remount with fresh server data whenever the cart contents differ */}
      <CartView
        key={cart.lines.map((l) => `${l.productId}:${l.quantity}`).join("|")}
        initialCart={cart}
      />
    </div>
  );
}
