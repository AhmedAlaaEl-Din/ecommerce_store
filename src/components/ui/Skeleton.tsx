import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-sunken animate-pulse rounded-md motion-reduce:animate-none", className)}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col" data-testid="product-card-skeleton">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="mt-4 h-3 w-16" />
      <Skeleton className="mt-2 h-5 w-3/4" />
      <Skeleton className="mt-2 h-5 w-14" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
