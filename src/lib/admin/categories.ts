/** Admin category management (admin only). */
import { z } from "zod";
import type { Db } from "../db";
import { assertCan, fail, type Actor } from "./actor";
import { changedFields, writeAudit } from "./audit";
import { fieldErrorsOf } from "./products";
import { SLUG_MAX, SLUG_RE, slugify } from "./slug";

export const categoryFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter a name (2–40 characters).")
      .max(40, "Use 40 characters or fewer."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(SLUG_MAX)
      .refine(
        (s) => s === "" || SLUG_RE.test(s),
        "Use lowercase letters, numbers and single hyphens.",
      ),
    description: z
      .string()
      .trim()
      .min(10, "Write a description (10–200 characters).")
      .max(200, "Use 200 characters or fewer."),
    accentColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #E8D9C4.")
      .transform((c) => c.toUpperCase()),
  })
  .transform((v) => ({ ...v, slug: v.slug || slugify(v.name) }));

export type CategoryData = z.output<typeof categoryFormSchema>;

export function parseCategoryForm(fd: FormData) {
  const parsed = categoryFormSchema.safeParse({
    name: fd.get("name") ?? "",
    slug: fd.get("slug") ?? "",
    description: fd.get("description") ?? "",
    accentColor: fd.get("accentColor") ?? "",
  });
  return parsed.success
    ? { ok: true as const, data: parsed.data }
    : { ok: false as const, fieldErrors: fieldErrorsOf(parsed.error) };
}

type Result =
  { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function slugTaken(err: unknown) {
  return (err as { code?: string }).code === "P2002";
}

export async function createCategory(db: Db, actor: Actor, data: CategoryData): Promise<Result> {
  assertCan(actor, "categories.manage");
  try {
    const c = await db.$transaction(async (tx) => {
      const row = await tx.category.create({ data });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "category.create",
        entityType: "Category",
        entityId: row.id,
        summary: { name: row.name, slug: row.slug },
      });
      return row;
    });
    return { ok: true, id: c.id };
  } catch (err) {
    if (slugTaken(err))
      return fail("Check the highlighted fields.", { slug: "Another category uses this slug." });
    throw err;
  }
}

export async function updateCategory(
  db: Db,
  actor: Actor,
  id: string,
  data: CategoryData,
): Promise<Result> {
  assertCan(actor, "categories.manage");
  const before = await db.category.findUnique({ where: { id } });
  if (!before) return fail("That category no longer exists.");
  try {
    await db.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "category.update",
        entityType: "Category",
        entityId: id,
        summary: {
          changes: changedFields(before, data, ["name", "slug", "description", "accentColor"]),
        },
      });
    });
    return { ok: true, id };
  } catch (err) {
    if (slugTaken(err))
      return fail("Check the highlighted fields.", { slug: "Another category uses this slug." });
    throw err;
  }
}

/** A category can't be deleted while any product (archived ones included) is in it. */
export async function deleteCategory(db: Db, actor: Actor, id: string) {
  assertCan(actor, "categories.manage");
  return db.$transaction(async (tx) => {
    const c = await tx.category.findUnique({
      where: { id },
      select: { name: true, _count: { select: { products: true } } },
    });
    if (!c) return fail("That category no longer exists.");
    if (c._count.products > 0) {
      return fail(
        `“${c.name}” still has ${c._count.products} product${c._count.products === 1 ? "" : "s"}. Move or delete them first.`,
      );
    }
    await tx.category.delete({ where: { id } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "category.delete",
      entityType: "Category",
      entityId: id,
      summary: { name: c.name },
    });
    return { ok: true as const };
  });
}
