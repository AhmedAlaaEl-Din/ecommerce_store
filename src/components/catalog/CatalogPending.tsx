"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition, type ReactNode } from "react";
import { ProductGridSkeleton } from "../ui/Skeleton";

type Ctx = { pending: boolean; navigate: (href: string, opts?: { replace?: boolean }) => void };

const CatalogNavContext = createContext<Ctx | null>(null);

/** Shares a single transition between catalog controls and results, so results show skeletons while loading. */
export function CatalogNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string, opts?: { replace?: boolean }) => {
      startTransition(() => {
        if (opts?.replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [router],
  );
  const value = useMemo(() => ({ pending, navigate }), [pending, navigate]);
  return <CatalogNavContext.Provider value={value}>{children}</CatalogNavContext.Provider>;
}

export function useCatalogNav(): Ctx {
  const ctx = useContext(CatalogNavContext);
  if (!ctx) throw new Error("useCatalogNav must be used inside <CatalogNavProvider>");
  return ctx;
}

export function CatalogResults({ children, skeletonCount }: { children: ReactNode; skeletonCount: number }) {
  const { pending } = useCatalogNav();
  return (
    <div aria-busy={pending || undefined} data-testid="catalog-results">
      {pending ? <ProductGridSkeleton count={Math.max(4, Math.min(skeletonCount, 12))} /> : children}
    </div>
  );
}
