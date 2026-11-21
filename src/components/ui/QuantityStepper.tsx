"use client";

import { cn } from "@/lib/cn";
import { MinusIcon, PlusIcon } from "../icons";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  /** Accessible name, e.g. "Quantity for Dune Ceramic Vase". */
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled = false,
  size = "md",
  className,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const btn =
    "inline-flex size-11 items-center justify-center text-ink transition-colors duration-150 ease-brand " +
    "hover:bg-sunken active:bg-line disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:bg-transparent";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "border-line-strong bg-surface inline-flex items-center overflow-hidden rounded-md border",
        size === "sm" && "sm:[&>button]:size-9",
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || atMin}
        aria-label="Decrease quantity"
      >
        <MinusIcon size={18} />
      </button>
      <output
        aria-live="polite"
        aria-label="Quantity"
        className="min-w-10 text-center font-semibold tabular-nums"
        data-testid="quantity-value"
      >
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || atMax}
        aria-label="Increase quantity"
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
