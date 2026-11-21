import Link from "next/link";
import { cn } from "@/lib/cn";

/** Text-only wordmark for the invented brand "Nile Goods". */
export function Wordmark({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn(
        "font-display text-ink inline-flex min-h-11 items-center gap-1 text-[1.375rem] leading-none font-semibold tracking-[-0.02em]",
        className,
      )}
      aria-label="Nile Goods, home"
    >
      Nile<span className="text-accent italic">Goods</span>
    </Link>
  );
}
