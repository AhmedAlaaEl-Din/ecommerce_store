import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "sale" | "low" | "out" | "neutral" | "new";

const tones: Record<BadgeTone, string> = {
  sale: "bg-accent text-white",
  low: "bg-warning-soft text-warning",
  out: "bg-danger-soft text-danger",
  neutral: "border border-line bg-surface text-ink",
  new: "bg-primary-soft text-primary",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm px-2 text-xs font-semibold tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
