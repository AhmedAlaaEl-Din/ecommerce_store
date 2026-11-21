"use client";

import { useActionState, useEffect, useState } from "react";
import type { CategoryFormState } from "@/app/admin/(panel)/categories/actions";
import { slugify } from "@/lib/admin/slug";
import { AlertIcon } from "../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export type CategoryValues = { name: string; slug: string; description: string; accentColor: string };

export function CategoryForm({
  action,
  initial,
  submitLabel,
}: {
  action: (s: CategoryFormState, fd: FormData) => Promise<CategoryFormState>;
  initial: CategoryValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  useEffect(() => setDirty(new Set()), [state]);
  const err = (k: string) => (dirty.has(k) ? undefined : state.fieldErrors?.[k]);
  const set = (k: keyof CategoryValues, value: string) => {
    setV((p) => ({ ...p, [k]: value, ...(k === "name" && !slugTouched ? { slug: slugify(value) } : {}) }));
    setDirty((d) => new Set(d).add(k));
  };
  const validColor = /^#[0-9a-fA-F]{6}$/.test(v.accentColor);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate data-testid="category-form">
      {state.error && (
        <div role="alert" className="bg-danger-soft text-danger flex gap-2 rounded-md p-3 text-sm" data-testid="form-error">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      <Input label="Name" name="name" value={v.name} onChange={(e) => set("name", e.target.value)} error={err("name")} maxLength={40} />
      <Input
        label="Slug"
        name="slug"
        value={v.slug}
        onChange={(e) => {
          setSlugTouched(true);
          set("slug", e.target.value.toLowerCase());
        }}
        error={err("slug")}
        hint={`URL: /products?category=${v.slug || "…"}`}
        spellCheck={false}
        maxLength={80}
      />
      <Input
        label="Description"
        name="description"
        value={v.description}
        onChange={(e) => set("description", e.target.value)}
        error={err("description")}
        maxLength={200}
      />
      <div className="flex items-end gap-3">
        <Input
          label="Accent colour"
          name="accentColor"
          value={v.accentColor}
          onChange={(e) => set("accentColor", e.target.value)}
          error={err("accentColor")}
          hint="Background behind product illustrations, e.g. #E8D9C4."
          maxLength={7}
          spellCheck={false}
          className="flex-1"
        />
        <span
          aria-hidden="true"
          className="border-line mb-7 size-11 shrink-0 rounded-sm border"
          style={{ backgroundColor: validColor ? v.accentColor : "transparent" }}
        />
      </div>
      <div>
        <Button type="submit" loading={pending} data-testid="category-save">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
