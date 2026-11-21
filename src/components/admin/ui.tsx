import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { hrefWith } from "@/lib/admin/format";
import {
  FULFILMENT_LABELS,
  PAYMENT_LABELS,
  type FulfilmentStatus,
  type PaymentStatus,
} from "@/lib/admin/order-rules";
import { AlertIcon, CheckIcon, ChevronLeftIcon, SortIcon } from "../icons";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="text-muted hover:text-ink -ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium lg:min-h-8"
        >
          <ChevronLeftIcon size={16} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight">{title}</h1>
          {description && <p className="text-muted mt-1 text-sm">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  padded = true,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("border-line bg-surface shadow-1 rounded-lg border", className)}
      aria-labelledby={title && id ? `${id}-title` : undefined}
    >
      {(title || actions) && (
        <div className="border-line flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2">
          {title && (
            <h2 id={id ? `${id}-title` : undefined} className="font-sans text-base font-semibold">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  pending_payment: "bg-warning-soft text-warning",
  paid: "bg-primary-soft text-primary",
  payment_failed: "bg-danger-soft text-danger",
  cancelled: "bg-sunken text-ink",
  expired: "bg-sunken text-ink",
  refunded: "bg-accent-soft text-accent",
};

const FULFILMENT_TONES: Record<FulfilmentStatus, string> = {
  unfulfilled: "bg-sunken text-ink",
  packed: "bg-warning-soft text-warning",
  shipped: "bg-primary-soft text-primary",
  delivered: "bg-success/15 text-success",
};

const pill =
  "inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 font-sans text-xs font-semibold tracking-normal";

export function PaymentBadge({ status }: { status: string }) {
  const s = status as PaymentStatus;
  return (
    <span className={cn(pill, PAYMENT_TONES[s] ?? "bg-sunken")}>{PAYMENT_LABELS[s] ?? status}</span>
  );
}

export function FulfilmentBadge({ status, muted }: { status: string; muted?: boolean }) {
  const s = status as FulfilmentStatus;
  if (muted) return <span className="text-muted text-xs">—</span>;
  return (
    <span className={cn(pill, FULFILMENT_TONES[s] ?? "bg-sunken")}>
      {FULFILMENT_LABELS[s] ?? status}
    </span>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-sunken text-ink",
    good: "bg-success/15 text-success",
    warn: "bg-warning-soft text-warning",
    bad: "bg-danger-soft text-danger",
    info: "bg-primary-soft text-primary",
  };
  return <span className={cn(pill, tones[tone])}>{children}</span>;
}

/** Success / error banner. Messages come from a fixed list, never from the URL. */
export function Notice({
  tone,
  children,
  testId = "notice",
}: {
  tone: "success" | "error";
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-testid={testId}
      className={cn(
        "mb-4 flex items-start gap-2 rounded-md px-3 py-2.5 text-sm",
        tone === "error" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
      )}
    >
      {tone === "error" ? (
        <AlertIcon size={18} className="mt-0.5 shrink-0" />
      ) : (
        <CheckIcon size={18} className="mt-0.5 shrink-0" />
      )}
      <div>{children}</div>
    </div>
  );
}

/** Shows a notice for ?done=<code> using a whitelist of messages. */
export function DoneNotice({
  code,
  messages,
}: {
  code: string | undefined;
  messages: Record<string, string>;
}) {
  if (!code || !(code in messages)) return null;
  return <Notice tone="success">{messages[code]}</Notice>;
}

/**
 * Table wrapper: scrolls inside its own box so the header row can stick to the
 * top while scrolling long lists (and scrolls sideways on small screens).
 */
export function TableWrap({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-line bg-surface shadow-1 max-h-[calc(100dvh-15rem)] min-h-40 overflow-auto rounded-lg border",
        className,
      )}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="w-full border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  );
}

export const thClass =
  "bg-sunken sticky top-0 z-10 border-b border-line px-3 py-2 text-left text-xs font-semibold tracking-[0.04em] text-muted uppercase whitespace-nowrap";
export const tdClass = "border-b border-line px-3 py-2.5 align-middle";

/** Sortable column header: a link that flips the direction. */
export function SortTh({
  label,
  column,
  path,
  params,
  sort,
  dir,
  align = "left",
}: {
  label: string;
  column: string;
  path: string;
  params: Record<string, string | undefined>;
  sort: string;
  dir: "asc" | "desc";
  align?: "left" | "right";
}) {
  const active = sort === column;
  const nextDir = active && dir === "desc" ? "asc" : "desc";
  return (
    <th
      scope="col"
      className={cn(thClass, align === "right" && "text-right")}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={hrefWith(path, params, { sort: column, dir: nextDir, page: undefined })}
        className={cn(
          "hover:text-ink inline-flex min-h-8 items-center gap-1",
          active && "text-ink",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <SortIcon size={14} className={active ? "opacity-100" : "opacity-40"} />
        <span className="sr-only">
          {active ? `, sorted ${dir === "asc" ? "ascending" : "descending"}` : ", sortable"}
        </span>
      </Link>
    </th>
  );
}

export function EmptyRow({
  colSpan,
  title,
  children,
}: {
  colSpan: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center" data-testid="empty-state">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-muted mt-1 text-sm">{children}</div>}
      </td>
    </tr>
  );
}

export function Kpi({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="border-line bg-surface shadow-1 rounded-lg border p-4" data-testid={testId}>
      <p className="text-muted text-xs font-semibold tracking-[0.06em] uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl leading-tight font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted mt-1 text-xs">{sub}</p>}
    </div>
  );
}

/** Small "x–y of z" line for lists. */
export function ResultCount({
  page,
  pageSize,
  total,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
}) {
  if (total === 0)
    return (
      <p className="text-muted text-sm" data-testid="result-count">
        No {noun}
      </p>
    );
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <p className="text-muted text-sm" data-testid="result-count">
      {from}–{to} of {total} {noun}
    </p>
  );
}

export const smallField =
  "h-10 rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink hover:border-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";
