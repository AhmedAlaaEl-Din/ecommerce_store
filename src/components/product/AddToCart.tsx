"use client";

import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/actions/cart";
import { MAX_QUANTITY_PER_LINE } from "@/lib/cart/math";
import { useCartCount } from "../cart/CartCountProvider";
import { BagIcon, CheckIcon } from "../icons";
import { Button } from "../ui/Button";
import { QuantityStepper } from "../ui/QuantityStepper";
import { useToast } from "../ui/Toast";

export function AddToCart({
  productId,
  productName,
  stock,
}: {
  productId: string;
  productName: string;
  stock: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const { setCount } = useCartCount();
  const { toast } = useToast();
  const outOfStock = stock <= 0;
  const max = Math.min(stock, MAX_QUANTITY_PER_LINE);

  function onAdd() {
    startTransition(async () => {
      const result = await addToCartAction({ productId, quantity });
      if (!result.ok) {
        toast({ tone: "error", title: "Couldn’t add to cart", description: result.message });
        return;
      }
      setCount(result.itemCount);
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <QuantityStepper
        value={quantity}
        max={max}
        onChange={setQuantity}
        label={`Quantity for ${productName}`}
        disabled={pending}
        className="self-start"
      />
      <Button
        size="lg"
        onClick={onAdd}
        loading={pending}
        disabled={pending}
        icon={justAdded ? <CheckIcon size={20} /> : <BagIcon size={20} />}
        className="disabled:bg-primary w-full disabled:text-white sm:w-auto sm:min-w-56"
        data-testid="add-to-cart"
      >
        {pending ? "Adding…" : justAdded ? "Added" : "Add to cart"}
      </Button>
    </div>
  );
}
