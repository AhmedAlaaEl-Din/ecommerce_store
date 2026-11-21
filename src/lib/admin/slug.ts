/** URL slugs for products and categories. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;

/** "Tide Wool Throw — Large!" -> "tide-wool-throw-large" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** First free slug: base, base-2, base-3, ... given the slugs already taken. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "item";
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = root.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "") + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}
