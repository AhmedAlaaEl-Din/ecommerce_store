import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { AlertIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { readCartId } from "@/lib/cart/cookie";
import { getCart } from "@/lib/cart/service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your cart",
  description:
    "Review the items in your Nile Goods cart before checkout. Demo store: test payments only.",
  robots: { index: false, follow: true },
};

type Props = PageProps<"/cart">;

/** Product ids from `?adjusted=` (set by checkout when stock ran out). */
function parseAdjusted(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(".")
    .filter((id) => /^[a-z0-9]{8,40}$/.test(id))
    .slice(0, 20);
}

export default async function CartPage({ searchParams }: Props) {
  const cart = await getCart(db, await readCartId());
  const adjustedIds = parseAdjusted((await searchParams).adjusted);
  const adjusted =
    adjustedIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: adjustedIds } },
          select: { name: true, stock: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <h1 className="mt-4 text-2xl sm:text-3xl">Your cart</h1>
      {adjusted.length > 0 && (
        <div
          role="alert"
          className="border-danger/40 bg-danger-soft mt-6 flex gap-3 rounded-lg border p-4"
          data-testid="stock-adjusted"
        >
          <AlertIcon size={20} className="text-danger mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-base font-semibold">
              Sorry, some items sold out while you were checking out.
            </p>
            <p className="mt-1">We updated your cart to what we have left. Nothing was charged.</p>
            <ul className="mt-2 ml-4 list-disc">
              {adjusted.map((p) => (
                <li key={p.name}>
                  {p.name}:{" "}
                  {p.stock > 0 ? `only ${p.stock} left, quantity reduced` : "sold out, removed"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* key: remount with fresh server data whenever the cart contents differ */}
      <CartView
        key={cart.lines.map((l) => `${l.productId}:${l.quantity}`).join("|")}
        initialCart={cart}
      />
    </div>
  );
}
