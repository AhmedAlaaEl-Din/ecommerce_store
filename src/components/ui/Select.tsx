import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "../icons";
import { fieldClasses } from "./Input";

type SelectProps = ComponentProps<"select"> & {
  label: string;
  hideLabel?: boolean;
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  error?: string;
};

export function Select({ label, hideLabel, options, error, className, id, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={selectId} className={cn("text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={cn(fieldClasses, "cursor-pointer appearance-none pr-10")}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          size={18}
          className="text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        />
      </div>
      {error && (
        <p id={errorId} className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
