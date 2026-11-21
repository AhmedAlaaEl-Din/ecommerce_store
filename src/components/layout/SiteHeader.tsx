"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useCartCount } from "../cart/CartCountProvider";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from "../icons";
import { fieldClasses } from "../ui/Input";
import { MobileMenu } from "./MobileMenu";
import { Wordmark } from "./Wordmark";

export type NavCategory = { slug: string; name: string };

export function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close transient UI when the route changes (state is adjusted during render,
  // as recommended by React, instead of in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  return (
    <header
      className={cn(
        "bg-surface/95 supports-[backdrop-filter]:bg-surface/85 sticky top-0 z-40 border-b backdrop-blur",
        "ease-brand transition-[box-shadow,border-color] duration-200",
        scrolled ? "border-line shadow-2" : "border-transparent",
      )}
      data-scrolled={scrolled || undefined}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:gap-6 lg:px-10">
        <button
          ref={menuButtonRef}
          type="button"
          className="hover:bg-sunken -ml-2 inline-flex size-11 items-center justify-center rounded-md lg:hidden"
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon size={22} />
        </button>

        <Wordmark />

        <Suspense
          fallback={<DesktopNav categories={categories} pathname={pathname} category={null} />}
        >
          <DesktopNavWithParams categories={categories} pathname={pathname} />
        </Suspense>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <form action="/products" role="search" className="hidden md:block">
            <label htmlFor="header-search" className="sr-only">
              Search products
            </label>
            <div className="relative">
              <SearchIcon
                size={18}
                className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                id="header-search"
                name="q"
                type="search"
                placeholder="Search products"
                autoComplete="off"
                maxLength={80}
                className={cn(fieldClasses, "bg-background h-10 w-56 rounded-full pl-9 xl:w-64")}
              />
            </div>
          </form>

          <button
            type="button"
            className="hover:bg-sunken inline-flex size-11 items-center justify-center rounded-md md:hidden"
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            aria-controls="mobile-search"
            onClick={() => setSearchOpen((v) => !v)}
          >
            {searchOpen ? <CloseIcon size={22} /> : <SearchIcon size={22} />}
          </button>

          <CartButton />
        </div>
      </div>

      {searchOpen && (
        <div id="mobile-search" className="border-line border-t px-4 py-3 md:hidden">
          <form action="/products" role="search" className="relative">
            <label htmlFor="mobile-search-input" className="sr-only">
              Search products
            </label>
            <SearchIcon
              size={18}
              className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              id="mobile-search-input"
              name="q"
              type="search"
              placeholder="Search products"
              autoComplete="off"
              maxLength={80}
              autoFocus
              className={cn(fieldClasses, "bg-background rounded-full pl-9")}
            />
          </form>
        </div>
      )}

      <MobileMenu
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          menuButtonRef.current?.focus();
        }}
        categories={categories}
      />
    </header>
  );
}

function CartButton() {
  const { count, bumpKey } = useCartCount();
  const label = count === 1 ? "Cart, 1 item" : `Cart, ${count} items`;
  return (
    <Link
      href="/cart"
      className="hover:bg-sunken relative -mr-2 inline-flex size-11 items-center justify-center rounded-md"
      aria-label={label}
      data-testid="cart-button"
    >
      <BagIcon size={24} />
      {count > 0 && (
        <span
          key={bumpKey}
          data-testid="cart-count"
          aria-hidden="true"
          className={cn(
            "bg-accent absolute top-0.5 right-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white tabular-nums",
            bumpKey > 0 && "animate-badge-bump",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

const navLinkClass =
  "inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-brand hover:bg-sunken";

function DesktopNavWithParams(props: { categories: NavCategory[]; pathname: string }) {
  const params = useSearchParams();
  return <DesktopNav {...props} category={params.get("category")} />;
}

function DesktopNav({
  categories,
  pathname,
  category,
}: {
  categories: NavCategory[];
  pathname: string;
  category: string | null;
}) {
  const onCatalog = pathname === "/products";
  const items = [
    { href: "/products", label: "Shop all", active: onCatalog && !category },
    ...categories.map((c) => ({
      href: `/products?category=${c.slug}`,
      label: c.name,
      active: onCatalog && category === c.slug,
    })),
  ];
  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                navLinkClass,
                item.active ? "bg-primary-soft text-primary" : "text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
