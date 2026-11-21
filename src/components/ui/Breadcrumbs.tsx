import Link from "next/link";
import { ChevronRightIcon } from "../icons";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted text-sm">
      <ol className="flex flex-wrap items-center gap-x-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-x-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-6"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-ink" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && <ChevronRightIcon size={14} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
