"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ProductFormState } from "@/app/admin/(panel)/products/actions";
import { slugify } from "@/lib/admin/slug";
import { cn } from "@/lib/cn";
import { AlertIcon } from "../icons";
import { ProductCard } from "../product/ProductCard";
import { Button } from "../ui/Button";
import { fieldClasses, Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { useFieldErrors } from "./useFieldErrors";

export type ProductFormValues = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: string;
  compareAt: string;
  stock: string;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
  imagePath: string;
};

type Category = { id: string; name: string; accentColor: string };

function parseCents(v: string): number | null {
  const s = v.trim().replace(/^\$/, "");
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0"));
}

function Textarea({
  label,
  name,
  value,
  onChange,
  error,
  rows,
  maxLength,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  rows: number;
  maxLength: number;
  hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(fieldClasses.replace("h-11", ""), "min-h-28 py-2 leading-6")}
      />
      {error ? (
        <p id={`${id}-error`} className="text-danger text-sm">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted text-sm">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function ProductForm({
  action,
  initial,
  categories,
  mode,
}: {
  action: (state: ProductFormState, fd: FormData) => Promise<ProductFormState>;
  initial: ProductFormValues;
  categories: Category[];
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [preview, setPreview] = useState<string | null>(null);
  const fields = useFieldErrors(state);
  const set = <K extends keyof ProductFormValues>(k: K, value: ProductFormValues[K]) => {
    setV((prev) => ({
      ...prev,
      [k]: value,
      ...(k === "name" && !slugTouched ? { slug: slugify(String(value)) } : {}),
    }));
    fields.touch(k);
  };
  // Errors clear as soon as their field is edited (same behaviour as checkout).
  const err = fields.error;
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const category = categories.find((c) => c.id === v.categoryId) ?? categories[0];
  const card = useMemo(
    () => ({
      slug: v.slug || "preview",
      name: v.name || "Product name",
      shortDescription: v.shortDescription || "Short description",
      priceCents: parseCents(v.price) ?? 0,
      compareAtCents: parseCents(v.compareAt),
      currency: "USD",
      stock: Number.parseInt(v.stock, 10) || 0,
      imagePath: preview ?? v.imagePath,
      category: {
        name: category?.name ?? "Category",
        accentColor: category?.accentColor ?? "#EFE8DC",
      },
    }),
    [v, preview, category],
  );

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]" noValidate>
      <div className="border-line bg-surface shadow-1 flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
        {state.error && (
          <div
            role="alert"
            className="bg-danger-soft text-danger flex gap-2 rounded-md p-3 text-sm"
            data-testid="form-error"
          >
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            <p>{state.error}</p>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Name"
            name="name"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            error={err("name")}
            maxLength={80}
            required
          />
          <Input
            label="Slug"
            name="slug"
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase());
            }}
            error={err("slug")}
            hint={`URL: /products/${v.slug || "…"}`}
            maxLength={80}
            spellCheck={false}
          />
        </div>
        <Input
          label="Short description"
          name="shortDescription"
          value={v.shortDescription}
          onChange={(e) => set("shortDescription", e.target.value)}
          error={err("shortDescription")}
          hint="Shown on product cards (10–160 characters)."
          maxLength={160}
        />
        <Textarea
          label="Description"
          name="description"
          rows={5}
          maxLength={2000}
          value={v.description}
          onChange={(x) => set("description", x)}
          error={err("description")}
          hint="Shown on the product page as plain text."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Price (USD)"
            name="price"
            inputMode="decimal"
            value={v.price}
            onChange={(e) => set("price", e.target.value)}
            error={err("price")}
            placeholder="24.00"
          />
          <Input
            label="Compare-at price"
            name="compareAt"
            inputMode="decimal"
            value={v.compareAt}
            onChange={(e) => set("compareAt", e.target.value)}
            error={err("compareAt")}
            hint="Optional; shows a sale."
          />
          {mode === "create" ? (
            <Input
              label="Opening stock"
              name="stock"
              inputMode="numeric"
              value={v.stock}
              onChange={(e) => set("stock", e.target.value)}
              error={err("stock")}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Stock</span>
              <p className="border-line bg-sunken flex h-11 items-center rounded-sm border px-3 tabular-nums">
                {v.stock}
              </p>
              <p className="text-muted text-sm">Change stock from Inventory, with a reason.</p>
            </div>
          )}
        </div>
        <Select
          label="Category"
          name="categoryId"
          value={v.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
          error={err("categoryId")}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-image" className="text-sm font-medium">
            Image
          </label>
          <input
            id="f-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={err("image") ? "f-image-error" : "f-image-hint"}
            aria-invalid={err("image") ? true : undefined}
            data-testid="image-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
              fields.touch("image");
            }}
            className="file:bg-sunken file:text-ink hover:file:bg-line text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:px-4 file:font-medium"
          />
          {err("image") ? (
            <p id="f-image-error" className="text-danger text-sm">
              {err("image")}
            </p>
          ) : (
            <p id="f-image-hint" className="text-muted text-sm">
              JPEG, PNG or WebP, up to 5 MB. It is cropped square, resized and stripped of metadata.
              {mode === "edit"
                ? " Leave empty to keep the current image."
                : " Without one, a neutral illustration is used."}
            </p>
          )}
        </div>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
          <legend className="sr-only">Visibility</legend>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              checked={v.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="accent-primary size-4"
            />
            Active (visible in the store)
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isFeatured"
              checked={v.isFeatured}
              onChange={(e) => set("isFeatured", e.target.checked)}
              className="accent-primary size-4"
            />
            Featured on the home page
          </label>
        </fieldset>
        <div className="border-line flex justify-end gap-2 border-t pt-4">
          <Button type="submit" loading={pending} data-testid="product-save">
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      </div>

      <aside aria-labelledby="preview-title">
        <div className="xl:sticky xl:top-20">
          <h2
            id="preview-title"
            className="text-muted mb-2 text-xs font-semibold tracking-[0.08em] uppercase"
          >
            Live preview
          </h2>
          {/* inert: the preview card is not a real link while editing */}
          <div
            inert
            className="border-line bg-background rounded-lg border p-4"
            data-testid="product-preview"
          >
            <ProductCard product={card} />
          </div>
          {!v.isActive && (
            <p className="text-warning mt-2 text-sm">Inactive: hidden from the store.</p>
          )}
        </div>
      </aside>
    </form>
  );
}
