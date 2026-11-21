"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "../icons";

export type ToastTone = "success" | "info" | "error";

export type ToastAction = { label: string; href: string } | { label: string; onClick: () => void };

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Default 5000. */
  duration?: number;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  toast: (t: ToastInput) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { ...t, id }].slice(-MAX_TOASTS));
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        <div role="status" aria-live="polite" className="contents">
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

const toneIcon: Record<ToastTone, ReactNode> = {
  success: <CheckIcon size={18} />,
  info: <InfoIcon size={18} />,
  error: <AlertIcon size={18} />,
};

const toneIconClass: Record<ToastTone, string> = {
  success: "bg-primary-soft text-success",
  info: "bg-sunken text-ink",
  error: "bg-danger-soft text-danger",
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { title, description, tone = "success", action, duration = 5000 } = toast;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onDismiss]);

  return (
    <div
      data-testid="toast"
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border border-line bg-surface p-3 pr-2 shadow-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          toneIconClass[tone],
        )}
      >
        {toneIcon[tone]}
      </span>
      <div className="min-w-0 flex-1 py-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action &&
        ("href" in action ? (
          <Link
            href={action.href}
            onClick={onDismiss}
            className="inline-flex h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold text-primary underline-offset-4 hover:bg-primary-soft hover:underline"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss();
            }}
            className="inline-flex h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            {action.label}
          </button>
        ))}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink"
      >
        <CloseIcon size={18} />
      </button>
    </div>
  );
}
