"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon, MenuIcon } from "../icons";
import { AdminNav } from "./AdminNav";
import type { AdminNavItem } from "./nav-items";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile admin navigation: a native <dialog> drawer (showModal makes the page
 * inert), with a Tab trap, Esc to close and focus returned to the menu button.
 */
export function AdminDrawer({ items, footer }: { items: AdminNavItem[]; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && d.open) {
      d.close();
      button.current?.focus();
    }
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab" || !ref.current) return;
    const els = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = els[0];
    const last = els[els.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="admin-drawer"
        data-testid="admin-menu-button"
        className="hover:bg-sunken -ml-2 inline-flex size-11 items-center justify-center rounded-md lg:hidden"
      >
        <MenuIcon size={22} />
      </button>
      <dialog
        ref={ref}
        id="admin-drawer"
        aria-label="Admin menu"
        data-testid="admin-drawer"
        onKeyDown={onKeyDown}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className={cn(
          "bg-surface text-ink shadow-3 m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none p-0",
          "backdrop:bg-ink/40 open:animate-drawer-in",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-line flex h-14 items-center justify-between border-b px-4">
            <span className="font-display text-lg font-semibold">
              Nile <span className="text-accent italic">Goods</span>{" "}
              <span className="text-muted font-sans text-xs font-semibold tracking-[0.08em] uppercase">
                Admin
              </span>
            </span>
            <button
              type="button"
              data-autofocus
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
              className="hover:bg-sunken -mr-2 inline-flex size-11 items-center justify-center rounded-md"
            >
              <CloseIcon size={22} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <AdminNav items={items} onNavigate={() => setOpen(false)} label="Admin (mobile)" />
          </div>
          <div className="border-line border-t p-3">{footer}</div>
        </div>
      </dialog>
    </>
  );
}
