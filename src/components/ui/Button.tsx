import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-brand " +
  "active:scale-[0.97] motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-1 hover:bg-primary-hover active:bg-primary-hover " +
    "disabled:bg-sunken disabled:text-muted disabled:shadow-none",
  secondary:
    "border border-line-strong bg-surface text-ink hover:border-ink hover:bg-sunken/60 " +
    "disabled:border-line disabled:text-muted disabled:hover:bg-surface",
  ghost:
    "text-ink hover:bg-sunken active:bg-sunken disabled:text-muted disabled:hover:bg-transparent",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-11 px-3.5 text-sm sm:h-9",
  md: "h-11 px-5 text-base",
  lg: "h-13 px-6 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Icon shown before the label; replaced by a spinner while loading. */
  icon?: ReactNode;
};

export type ButtonProps = CommonProps & ComponentProps<"button"> & { loading?: boolean };

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  icon,
  className,
  children,
  type = "button",
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  // While loading, the button keeps its normal colours (it is busy, not unavailable):
  // it is not natively disabled, so `disabled:` styles don't apply, but clicks are
  // ignored and assistive tech is told it is busy and disabled.
  return (
    <button
      type={type}
      className={buttonClasses({
        variant,
        size,
        fullWidth,
        className: cn(loading && "cursor-progress", className),
      })}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      data-loading={loading || undefined}
      {...props}
      disabled={loading ? false : disabled}
      onClick={loading ? (e) => e.preventDefault() : onClick}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export type ButtonLinkProps = CommonProps & ComponentProps<typeof Link>;

export function ButtonLink({
  variant,
  size,
  fullWidth,
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
