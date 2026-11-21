"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 15; // 30 seconds

/**
 * Shown while an order is still `pending_payment`: re-renders the (server) page
 * every 2 seconds for up to 30 seconds. The page itself reads the status from
 * the database; nothing here trusts the client.
 */
export function OrderStatusPoller() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const gaveUp = attempts >= MAX_ATTEMPTS;

  useEffect(() => {
    if (gaveUp) return;
    const t = window.setTimeout(() => {
      setAttempts((a) => a + 1);
      router.refresh();
    }, INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [attempts, gaveUp, router]);

  if (gaveUp) {
    return (
      <div className="mt-6 text-sm" data-testid="confirming-slow">
        <p>
          This is taking longer than usual. Your payment may still be processing, and you don’t need
          to pay again.
        </p>
        <button
          type="button"
          onClick={() => {
            setAttempts(0);
            router.refresh();
          }}
          className="text-primary mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Check again
        </button>
      </div>
    );
  }

  return (
    <p className="text-muted mt-6 text-sm" aria-hidden="true">
      Checking every few seconds…
    </p>
  );
}
