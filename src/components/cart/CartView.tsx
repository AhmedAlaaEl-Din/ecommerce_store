"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  removeCartItemAction,
  restoreCartItemAction,
  updateCartItemAction,
  type CartMutationResult,
} from "@/app/actions/cart";
import {
  cartTotals,
  FREE_SHIPPING_THRESHOLD_CENTS,
  lineTotalCents,
  MAX_QUANTITY_PER_LINE,
} from "@/lib/cart/math";
import type { CartLine, CartView as CartData } from "@/lib/cart/service";
import { formatMoney } from "@/lib/money";
import { LOW_STOCK_THRESHOLD } from "@/lib/pricing";
import { ArrowRightIcon, ShieldIcon, TrashIcon } from "../icons";
import { Button, ButtonLink } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Price } from "../ui/Price";
import { QuantityStepper } from "../ui/QuantityStepper";
import { useToast } from "../ui/Toast";
import { useCartCount } from "./CartCountProvider";

function withLines(cart: CartData, lines: CartLine[]): CartData {
  return { ...cart, lines, ...cartTotals(lines.filter((l) => !l.unavailable)) };
}

export function CartView({ initialCart }: { initialCart: CartData }) {
  const [cart, setCart] = useState(initialCart);
  const [, startTransition] = useTransition();
  const { setCount } = useCartCount();
  const { toast } = useToast();
  // Only the response to the most recent request is applied, so fast clicks
  // can never be overwritten by an older, slower response.
  const latestRequest = useRef(0);

  // Mirrors the latest cart so callbacks created earlier (e.g. a toast Undo) see current data.
  const cartRef = useRef(cart);

  function apply(next: CartData) {
    cartRef.current = next;
    setCart(next);
    setCount(next.itemCount);
  }

  function run(
    optimistic: CartData,
    request: () => Promise<CartMutationResult>,
    onOk?: (r: Extract<CartMutationResult, { ok: true }>) => void,
  ) {
    const id = ++latestRequest.current;
    const previous = cartRef.current;
    apply(optimistic);
    startTransition(async () => {
      const result = await request();
      if (id !== latestRequest.current) return;
      if (result.ok) {
        apply(result.cart);
        onOk?.(result);
      } else {
        apply(result.cart ?? previous);
        toast({ tone: "error", title: "Your cart wasn’t updated", description: result.message });
      }
    });
  }

  function changeQuantity(line: CartLine, quantity: number) {
    const lines = cartRef.current.lines.map((l) =>
      l.productId === line.productId
        ? { ...l, quantity, lineTotalCents: lineTotalCents({ priceCents: l.priceCents, quantity }) }
        : l,
    );
    run(
      withLines(cartRef.current, lines),
      () => updateCartItemAction({ productId: line.productId, quantity }),
      (r) => {
        if (r.limited) {
          toast({
            tone: "info",
            title: `Only ${line.stock} available`,
            description: `We’ve set ${line.name} to the most we have.`,
          });
        }
      },
    );
  }

  function remove(line: CartLine) {
    const lines = cartRef.current.lines.filter((l) => l.productId !== line.productId);
    run(
      withLines(cartRef.current, lines),
      () => removeCartItemAction({ productId: line.productId }),
      (r) => {
        const removed = r.removed ?? { productId: line.productId, quantity: line.quantity };
        toast({
          title: "Removed from cart",
          description: line.name,
          tone: "info",
          duration: 7000,
          action: { label: "Undo", onClick: () => undo(line, removed.quantity) },
        });
      },
    );
  }

  function undo(line: CartLine, quantity: number) {
    // Optimistically put the line back where it was.
    const restored = {
      ...line,
      quantity,
      lineTotalCents: lineTotalCents({ priceCents: line.priceCents, quantity }),
    };
    const id = ++latestRequest.current;
    const current = cartRef.current;
    if (!current.lines.some((l) => l.productId === line.productId)) {
      apply(withLines(current, [...current.lines, restored]));
    }
    startTransition(async () => {
      const result = await restoreCartItemAction({ productId: line.productId, quantity });
      if (id !== latestRequest.current) return;
      if (result.ok) {
        apply(result.cart);
        toast({ title: "Item restored", description: line.name });
      } else {
        if (result.cart) apply(result.cart);
        toast({ tone: "error", title: "Couldn’t restore that item", description: result.message });
      }
    });
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mt-10">
        <EmptyState
          title="Your cart is empty"
          testId="empty-cart"
          action={
            <ButtonLink href="/products" size="lg">
              Start shopping
              <ArrowRightIcon size={18} />
            </ButtonLink>
          }
        >
          <p>Nothing here yet. Our ceramics, linen and paper goods are a good place to start.</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_22rem] lg:gap-12">
      <section aria-labelledby="cart-items-heading">
        <h2 id="cart-items-heading" className="sr-only">
          Items in your cart
        </h2>
        <ul className="divide-line border-line divide-y border-y" data-testid="cart-lines">
          {cart.lines.map((line) => (
            <CartLineRow
              key={line.productId}
              line={line}
              onQuantity={(q) => changeQuantity(line, q)}
              onRemove={() => remove(line)}
            />
          ))}
        </ul>
        <Link
          href="/products"
          className="text-primary mt-6 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
        >
          Continue shopping <ArrowRightIcon size={16} />
        </Link>
      </section>

      <OrderSummary cart={cart} />
    </div>
  );
}

function CartLineRow({
  line,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  onQuantity: (q: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex gap-4 py-5 sm:gap-6" data-testid="cart-line" data-product={line.slug}>
      <Link
        href={`/products/${line.slug}`}
        className="shrink-0 self-start overflow-hidden rounded-lg"
        style={{ backgroundColor: line.accentColor }}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={line.imagePath}
          alt=""
          width={600}
          height={600}
          unoptimized
          className="size-24 sm:size-32"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-muted text-xs font-semibold tracking-[0.08em] uppercase">
              {line.categoryName}
            </p>
            <h3 className="font-sans text-base font-semibold tracking-normal sm:text-lg">
              <Link href={`/products/${line.slug}`} className="underline-offset-4 hover:underline">
                {line.name}
              </Link>
            </h3>
            <Price
              priceCents={line.priceCents}
              compareAtCents={line.compareAtCents}
              currency={line.currency}
              size="sm"
              className="text-sm"
            />
          </div>
          <p
            className="hidden text-lg font-semibold tabular-nums sm:block"
            data-testid="line-total"
          >
            {formatMoney(line.lineTotalCents, line.currency)}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-3">
            <QuantityStepper
              value={line.quantity}
              max={Math.max(1, Math.min(line.stock, MAX_QUANTITY_PER_LINE))}
              onChange={onQuantity}
              disabled={line.unavailable}
              label={`Quantity for ${line.name}`}
              size="sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              icon={<TrashIcon size={18} />}
              aria-label={`Remove ${line.name} from cart`}
              className="text-muted hover:text-danger w-11 px-0 sm:w-auto sm:px-3.5"
              data-testid="remove-line"
            >
              <span className="hidden sm:inline">Remove</span>
            </Button>
          </div>
          <p className="text-base font-semibold tabular-nums sm:hidden" aria-hidden="true">
            {formatMoney(line.lineTotalCents, line.currency)}
          </p>
        </div>
        {line.unavailable ? (
          <p className="text-danger mt-2 text-sm font-medium" data-testid="line-unavailable">
            Sold out since you added it. It isn’t included in your total; please remove it.
          </p>
        ) : (
          line.quantity >= line.stock &&
          line.stock <= LOW_STOCK_THRESHOLD && (
            <p className="text-warning mt-2 text-sm">
              Only {line.stock} available. You have them all.
            </p>
          )
        )}
      </div>
    </li>
  );
}

function OrderSummary({ cart }: { cart: CartData }) {
  // Phase 1 sells in one currency (see SUPPORTED_CURRENCIES); use the cart's.
  const currency = cart.lines[0]?.currency ?? "USD";
  const savings = cart.lines.reduce(
    (sum, l) =>
      !l.unavailable && l.compareAtCents != null && l.compareAtCents > l.priceCents
        ? sum + (l.compareAtCents - l.priceCents) * l.quantity
        : sum,
    0,
  );
  const progress = Math.min(
    100,
    Math.round((cart.subtotalCents / FREE_SHIPPING_THRESHOLD_CENTS) * 100),
  );
  return (
    <aside
      aria-labelledby="summary-heading"
      className="border-line bg-surface shadow-1 rounded-xl border p-5 sm:p-6 lg:sticky lg:top-24"
      data-testid="order-summary"
    >
      <h2 id="summary-heading" className="text-xl">
        Order summary
      </h2>

      <div className="bg-background mt-4 rounded-lg p-3 text-sm">
        {cart.amountToFreeShippingCents > 0 ? (
          <p>
            You’re{" "}
            <strong className="tabular-nums">
              {formatMoney(cart.amountToFreeShippingCents, currency)}
            </strong>{" "}
            away from free shipping.
          </p>
        ) : (
          <p className="text-success font-medium">You’ve unlocked free shipping.</p>
        )}
        <div
          className="bg-sunken mt-2 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Progress to free shipping"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="bg-primary ease-brand h-full rounded-full transition-[width] duration-250"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <dl className="mt-5 flex flex-col gap-3 text-sm" aria-live="polite">
        <div className="flex justify-between">
          <dt className="text-muted">
            Subtotal ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})
          </dt>
          <dd className="font-medium tabular-nums" data-testid="subtotal">
            {formatMoney(cart.subtotalCents, currency)}
          </dd>
        </div>
        {savings > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Sale savings</dt>
            <dd className="text-accent font-medium tabular-nums" data-testid="savings">
              −{formatMoney(savings, currency)}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd className="font-medium tabular-nums" data-testid="shipping">
            {cart.shippingCents === 0 ? "Free" : formatMoney(cart.shippingCents, currency)}
          </dd>
        </div>
        <div className="border-line flex justify-between border-t pt-3 text-base">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-xl font-semibold tabular-nums" data-testid="total">
            {formatMoney(cart.totalCents, currency)}
          </dd>
        </div>
      </dl>

      <ButtonLink
        href="/checkout"
        size="lg"
        fullWidth
        className="mt-6"
        data-testid="checkout"
        icon={<ShieldIcon size={18} />}
      >
        Checkout
      </ButtonLink>
      <p className="text-muted mt-3 text-center text-xs">
        Demo store: mock or test-mode payments only. No real money is taken.
      </p>
    </aside>
  );
}
