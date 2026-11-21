"use client";

import { useEffect } from "react";
import { useCartCount } from "./CartCountProvider";

/** Pushes a server-known cart count into the header badge (e.g. 0 after a paid order). */
export function CartCountSync({ count }: { count: number }) {
  const { setCount } = useCartCount();
  useEffect(() => {
    setCount(count);
  }, [count, setCount]);
  return null;
}
