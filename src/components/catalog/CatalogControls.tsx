"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { SORT_LABELS, withChanges } from "@/lib/catalog-url";
import { SORT_OPTIONS, type CatalogQuery, type SortOption } from "@/lib/schemas";
import { CloseIcon, SearchIcon, SlidersIcon } from "../icons";
import { Button } from "../ui/Button";
import { fieldClasses } from "../ui/Input";
import { Select } from "../ui/Select";
import { useCatalogNav } from "./CatalogPending";

type Category = { slug: string; name: string };

export function CatalogControls({
  query,
  categories,
}: {
  query: CatalogQuery;
  categories: Category[];
}) {
  const { navigate } = useCatalogNav();
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const activeFilters = (query.category ? 1 : 0) + (query.sort !== "newest" ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <SearchBox
          query={query}
          onSearch={(q) => navigate(withChanges(query, { q }), { replace: true })}
        />
        <div className="hidden md:block md:w-56">
          <Select
            label="Sort by"
            value={query.sort}
            options={SORT_OPTIONS.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
            onChange={(e) => navigate(withChanges(query, { sort: e.target.value as SortOption }))}
            data-testid="sort-select"
          />
        </div>
        <Button
          ref={filterButtonRef}
          variant="secondary"
          className="md:hidden"
          icon={<SlidersIcon size={18} />}
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          data-testid="open-filters"
        >
          Filters
          {activeFilters > 0 && (
            <span className="bg-primary inline-flex size-5 items-center justify-center rounded-full text-xs text-white">
              {activeFilters}
            </span>
          )}
        </Button>
      </div>

      <div className="hidden md:block" role="group" aria-label="Filter by category">
        <ul className="flex flex-wrap gap-2">
          <li>
            <CategoryChip
              active={!query.category}
              onClick={() => navigate(withChanges(query, { category: null }))}
            >
              All
            </CategoryChip>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <CategoryChip
                active={query.category === c.slug}
                onClick={() => navigate(withChanges(query, { category: c.slug }))}
              >
                {c.name}
              </CategoryChip>
            </li>
          ))}
        </ul>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          filterButtonRef.current?.focus();
        }}
        query={query}
        categories={categories}
        onApply={(category, sort) => {
          setSheetOpen(false);
          navigate(withChanges(query, { category, sort }));
        }}
      />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "ease-brand inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150",
        active
          ? "border-primary bg-primary text-white"
          : "border-line-strong/60 bg-surface text-ink hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}

function SearchBox({ query, onSearch }: { query: CatalogQuery; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(query.q ?? "");
  const [lastQ, setLastQ] = useState(query.q ?? "");
  const debounce = useRef<number | undefined>(undefined);

  // Keep the box in sync when the URL changes elsewhere (e.g. header search, reset).
  if ((query.q ?? "") !== lastQ) {
    setLastQ(query.q ?? "");
    setValue(query.q ?? "");
  }

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  function schedule(next: string) {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      if (next.trim() !== (query.q ?? "")) onSearch(next.trim());
    }, 350);
  }

  return (
    <form
      role="search"
      className="flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        window.clearTimeout(debounce.current);
        onSearch(value.trim());
      }}
    >
      <label htmlFor="catalog-search" className="mb-1.5 block text-sm font-medium">
        Search
      </label>
      <div className="relative">
        <SearchIcon
          size={18}
          className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <input
          id="catalog-search"
          type="search"
          name="q"
          value={value}
          maxLength={80}
          autoComplete="off"
          placeholder="Search products"
          onChange={(e) => {
            setValue(e.target.value);
            schedule(e.target.value);
          }}
          className={cn(fieldClasses, "pr-11 pl-10")}
          data-testid="catalog-search"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            className="text-muted hover:text-ink absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center"
            onClick={() => {
              setValue("");
              window.clearTimeout(debounce.current);
              onSearch("");
            }}
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>
    </form>
  );
}

function FilterSheet({
  open,
  onClose,
  query,
  categories,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  query: CatalogQuery;
  categories: Category[];
  onApply: (category: string | null, sort: SortOption) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<string | null>(query.category ?? null);
  const [sort, setSort] = useState<SortOption>(query.sort);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setCategory(query.category ?? null);
      setSort(query.sort);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, query.category, query.sort]);

  const optionClass =
    "flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 hover:bg-sunken has-[:checked]:bg-primary-soft has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary";

  return (
    <dialog
      ref={ref}
      aria-labelledby="filter-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="bg-surface text-ink shadow-3 backdrop:bg-ink/40 open:animate-sheet-in m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-xl p-0"
      data-testid="filter-sheet"
    >
      <form
        className="flex max-h-[85dvh] flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(category, sort);
        }}
      >
        <div className="border-line flex items-center justify-between border-b px-4 py-2">
          <h2 id="filter-sheet-title" className="text-xl">
            Filter &amp; sort
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="hover:bg-sunken -mr-2 inline-flex size-11 items-center justify-center rounded-md"
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <fieldset>
            <legend className="text-muted px-3 pb-2 text-xs font-semibold tracking-[0.08em] uppercase">
              Category
            </legend>
            <label className={optionClass}>
              <input
                type="radio"
                name="category"
                className="size-5"
                checked={category === null}
                onChange={() => setCategory(null)}
              />
              All products
            </label>
            {categories.map((c) => (
              <label key={c.slug} className={optionClass}>
                <input
                  type="radio"
                  name="category"
                  className="size-5"
                  checked={category === c.slug}
                  onChange={() => setCategory(c.slug)}
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="mt-6">
            <legend className="text-muted px-3 pb-2 text-xs font-semibold tracking-[0.08em] uppercase">
              Sort by
            </legend>
            {SORT_OPTIONS.map((s) => (
              <label key={s} className={optionClass}>
                <input
                  type="radio"
                  name="sort"
                  className="size-5"
                  checked={sort === s}
                  onChange={() => setSort(s)}
                />
                {SORT_LABELS[s]}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="border-line flex gap-3 border-t p-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setCategory(null);
              setSort("newest");
            }}
          >
            Reset
          </Button>
          <Button type="submit" className="flex-[2]" data-testid="apply-filters">
            Show results
          </Button>
        </div>
      </form>
    </dialog>
  );
}
