import Link from "next/link";
import { cn } from "@/lib/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

/** Page numbers to show, with "gap" markers, e.g. [1, "gap", 4, 5, 6, "gap", 10]. */
export function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const item =
  "inline-flex size-11 items-center justify-center rounded-md text-sm font-medium transition-colors duration-150 ease-brand";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {prev ? (
        <Link
          href={hrefFor(prev)}
          className={cn(item, "hover:bg-sunken")}
          aria-label="Previous page"
        >
          <ChevronLeftIcon size={18} />
        </Link>
      ) : (
        <span className={cn(item, "text-line-strong")} aria-hidden="true">
          <ChevronLeftIcon size={18} />
        </span>
      )}
      <ul className="flex items-center gap-1">
        {pageWindow(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className={cn(item, "text-muted")} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(item, p === page ? "bg-ink text-white" : "text-ink hover:bg-sunken")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      {next ? (
        <Link href={hrefFor(next)} className={cn(item, "hover:bg-sunken")} aria-label="Next page">
          <ChevronRightIcon size={18} />
        </Link>
      ) : (
        <span className={cn(item, "text-line-strong")} aria-hidden="true">
          <ChevronRightIcon size={18} />
        </span>
      )}
    </nav>
  );
}
