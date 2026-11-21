"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRightIcon, CloseIcon, SearchIcon } from "../icons";
import { fieldClasses } from "../ui/Input";
import { cn } from "@/lib/cn";
import type { NavCategory } from "./SiteHeader";
import { Wordmark } from "./Wordmark";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile navigation drawer built on the native <dialog> element (showModal makes
 * the rest of the page inert). Focus is additionally trapped with Tab/Shift+Tab,
 * Esc closes it, and focus returns to the menu button via onClose.
 */
export function MobileMenu({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: NavCategory[];
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) document.documentElement.style.overflow = "";
  }, [open]);

  useEffect(() => () => void (document.documentElement.style.overflow = ""), []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab" || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const linkClass =
    "flex min-h-12 items-center justify-between rounded-md px-3 text-lg font-medium hover:bg-sunken";

  return (
    <dialog
      ref={ref}
      id="mobile-menu"
      aria-label="Menu"
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        // Esc: let React state drive closing so focus is restored consistently.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "bg-surface text-ink shadow-3 m-0 h-dvh max-h-none w-[min(22rem,88vw)] max-w-none p-0",
        "backdrop:bg-ink/40 open:animate-drawer-in",
      )}
      data-testid="mobile-menu"
    >
      <div className="flex h-full flex-col">
        <div className="border-line flex h-16 items-center justify-between border-b px-4">
          <Wordmark onClick={onClose} />
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Close menu"
            className="hover:bg-sunken -mr-2 inline-flex size-11 items-center justify-center rounded-md"
          >
            <CloseIcon size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          <form action="/products" role="search" className="relative mx-2 mb-4" onSubmit={onClose}>
            <label htmlFor="menu-search" className="sr-only">
              Search products
            </label>
            <SearchIcon
              size={18}
              className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              id="menu-search"
              name="q"
              type="search"
              placeholder="Search products"
              autoComplete="off"
              maxLength={80}
              className={cn(fieldClasses, "bg-background rounded-full pl-9")}
            />
          </form>

          <nav aria-label="Mobile">
            <p className="text-muted px-3 pb-1 text-xs font-semibold tracking-[0.08em] uppercase">
              Shop
            </p>
            <ul>
              <li>
                <Link href="/products" className={linkClass} onClick={onClose}>
                  Shop all <ArrowRightIcon size={18} className="text-muted" />
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/products?category=${c.slug}`}
                    className={linkClass}
                    onClick={onClose}
                  >
                    {c.name} <ArrowRightIcon size={18} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-muted mt-6 px-3 pb-1 text-xs font-semibold tracking-[0.08em] uppercase">
              More
            </p>
            <ul>
              <li>
                <Link href="/cart" className={linkClass} onClick={onClose}>
                  Your cart <ArrowRightIcon size={18} className="text-muted" />
                </Link>
              </li>
              <li>
                <Link href="/info#shipping" className={linkClass} onClick={onClose}>
                  Shipping &amp; returns <ArrowRightIcon size={18} className="text-muted" />
                </Link>
              </li>
              <li>
                <Link href="/info#about" className={linkClass} onClick={onClose}>
                  About Nile Goods <ArrowRightIcon size={18} className="text-muted" />
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="border-line text-muted border-t px-6 py-4 text-sm">
          Demo store, portfolio project, no real orders.
        </p>
      </div>
    </dialog>
  );
}
