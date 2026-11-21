import { Skeleton, ProductGridSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10" aria-busy="true">
      <span className="sr-only" role="status">
        Loading products…
      </span>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-10 w-64" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <Skeleton className="mt-8 h-11 w-full" />
      <div className="mt-10">
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
