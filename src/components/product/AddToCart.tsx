"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addToCartAction } from "@/app/actions/cart";
import { maxPerLine, remainingAddable } from "@/lib/cart/math";
import { useCartCount } from "../cart/CartCountProvider";
import { BagIcon, CheckIcon } from "../icons";
import { Button, ButtonLink } from "../ui/Button";
import { QuantityStepper } from "../ui/QuantityStepper";
import { useToast } from "../ui/Toast";

export function AddToCart({
  productId,
  productName,
  stock,
  inCart = 0,
}: {
  productId: string;
  productName: string;
  stock: number;
  /** Units of this product already in the visitor's cart (clamped to stock). */
  inCart?: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [held, setHeld] = useState(inCart);
  // Follow the server's figure when it changes (e.g. the route refreshes after an action),
  // without re-mounting, so focus handling below survives.
  const [serverInCart, setServerInCart] = useState(inCart);
  if (inCart !== serverInCart) {
    setServerInCart(inCart);
    setHeld(inCart);
  }
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const { setCount } = useCartCount();
  const { toast } = useToast();
  const outOfStock = stock <= 0;
  const remaining = remainingAddable(stock, held);
  const allInCart = !outOfStock && remaining === 0;
  const fullPanel = useRef<HTMLDivElement>(null);
  const filledByThisAdd = useRef(false);

  // The add button disappears when the last unit is added; keep keyboard focus nearby.
  useEffect(() => {
    if (allInCart && filledByThisAdd.current) {
      filledByThisAdd.current = false;
      fullPanel.current?.querySelector<HTMLElement>("a")?.focus();
    }
  }, [allInCart]);

  function onAdd() {
    startTransition(async () => {
      const result = await addToCartAction({ productId, quantity: Math.min(quantity, remaining) });
      if (!result.ok) {
        toast({ tone: "error", title: "Couldn’t add to cart", description: result.message });
        return;
      }
      setCount(result.itemCount);
      filledByThisAdd.current = remainingAddable(stock, result.quantity) === 0;
      setHeld(result.quantity);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1600);
      toast({
        title: "Added to cart",
        description: result.limited
          ? `Only ${result.stock} available, so your cart has ${result.quantity} of ${productName}.`
          : `${quantity} × ${productName}`,
        tone: result.limited ? "info" : "success",
        action: { label: "View cart", href: "/cart" },
      });
      setQuantity(1);
    });
  }

  if (outOfStock) {
    return (
      <div className="flex flex-col gap-3">
        <Button size="lg" fullWidth disabled data-testid="add-to-cart" className="sm:w-auto">
          Out of stock
        </Button>
        <p className="text-muted text-sm">
          This one has sold out. Have a look at similar pieces below.
        </p>
      </div>
    );
  }

  if (allInCart) {
    const n = maxPerLine(stock);
    return (
      <div ref={fullPanel} className="flex flex-col gap-3" data-testid="all-in-cart">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            disabled
            data-testid="add-to-cart"
            className="w-full sm:w-auto sm:min-w-56"
          >
            {n === 1 ? "The only one is in your cart" : `All ${n} are in your cart`}
          </Button>
          <ButtonLink href="/cart" variant="secondary" size="lg" className="w-full sm:w-auto">
            View cart
          </ButtonLink>
        </div>
        <p className="text-muted text-sm">
          You have every one we have in stock. Change the quantity in your cart.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <QuantityStepper
        value={Math.min(quantity, remaining)}
        max={remaining}
        onChange={setQuantity}
        label={`Quantity for ${productName}`}
        disabled={pending}
        className="self-start"
      />
      <Button
        size="lg"
        onClick={onAdd}
        loading={pending}
        icon={justAdded ? <CheckIcon size={20} /> : <BagIcon size={20} />}
        className="w-full sm:w-auto sm:min-w-56"
        data-testid="add-to-cart"
      >
        {pending ? "Adding…" : justAdded ? "Added" : "Add to cart"}
      </Button>
    </div>
  );
}
