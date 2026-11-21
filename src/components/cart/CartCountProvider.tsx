"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type CartCountContextValue = {
  count: number;
  /** Increments on every change so the header badge can replay its animation. */
  bumpKey: number;
  setCount: (count: number) => void;
};

const CartCountContext = createContext<CartCountContextValue | null>(null);

export function CartCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCountState] = useState(initialCount);
  const [bumpKey, setBumpKey] = useState(0);

  const countRef = useRef(initialCount);

  const setCount = useCallback((next: number) => {
    if (next === countRef.current) return;
    countRef.current = next;
    setCountState(next);
    setBumpKey((k) => k + 1);
  }, []);

  const value = useMemo(() => ({ count, bumpKey, setCount }), [count, bumpKey, setCount]);
  return <CartCountContext.Provider value={value}>{children}</CartCountContext.Provider>;
}

export function useCartCount(): CartCountContextValue {
  const ctx = useContext(CartCountContext);
  if (!ctx) throw new Error("useCartCount must be used inside <CartCountProvider>");
  return ctx;
}
