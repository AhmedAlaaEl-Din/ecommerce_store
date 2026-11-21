"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "../ui/Button";

function SubmitButton({
  label,
  tone,
  testId,
}: {
  label: string;
  tone: "danger" | "primary";
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      data-testid={testId}
      variant={tone === "danger" ? "danger" : "primary"}
    >
      {label}
    </Button>
  );
}

/**
 * Destructive or important actions ask first. The trigger opens a native modal
 * <dialog>; the form (with any extra fields, e.g. "restock items") lives inside
 * it and posts to a server action, so nothing happens until Confirm is pressed.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerVariant = "secondary",
  triggerClassName,
  title,
  children,
  confirmLabel,
  tone = "danger",
  action,
  hidden,
  testId,
}: {
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  action: (fd: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = `${testId ?? "confirm"}-title`;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && d.open) {
      d.close();
      trigger.current?.focus();
    }
  }, [open]);

  return (
    <>
      <Button
        ref={trigger}
        variant={triggerVariant}
        size="sm"
        onClick={() => setOpen(true)}
        data-testid={testId ? `${testId}-open` : undefined}
        className={triggerClassName}
      >
        <span
          className={
            tone === "danger" && triggerVariant === "secondary" ? "text-danger" : undefined
          }
        >
          {triggerLabel}
        </span>
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className="bg-surface text-ink shadow-3 backdrop:bg-ink/40 m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg p-0"
        data-testid={testId}
      >
        <form action={action} className="p-5">
          {hidden &&
            Object.entries(hidden).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <h2 id={titleId} className="font-sans text-lg font-semibold">
            {title}
          </h2>
          {children && <div className="text-muted mt-2 text-sm">{children}</div>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" data-autofocus onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton
              label={confirmLabel}
              tone={tone}
              testId={testId ? `${testId}-confirm` : undefined}
            />
          </div>
        </form>
      </dialog>
    </>
  );
}
