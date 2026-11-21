import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const fieldClasses =
  "h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-base text-ink " +
  "placeholder:text-muted transition-[border-color,box-shadow] duration-150 ease-brand " +
  "hover:border-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 " +
  "aria-[invalid=true]:border-danger";

type InputProps = ComponentProps<"input"> & {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
};

export function Input({
  label,
  hideLabel,
  hint,
  error,
  leadingIcon,
  className,
  id,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className={cn("text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          className={cn(fieldClasses, leadingIcon ? "pl-10" : undefined)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
