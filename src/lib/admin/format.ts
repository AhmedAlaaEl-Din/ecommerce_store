/** Admin display helpers. Times are shown in UTC so every user sees the same thing. */
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function fmtDateTime(d: Date | null | undefined): string {
  return d ? `${dateTime.format(d)} UTC` : "—";
}

export function fmtDate(d: Date | null | undefined): string {
  return d ? dateOnly.format(d) : "—";
}

type Params = Record<string, string | undefined>;

/** Builds a URL from the current params plus overrides (undefined/"" removes a key). */
export function hrefWith(path: string, current: Params, overrides: Params = {}): string {
  const sp = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Reads a single string from Next's searchParams (arrays take the first value). */
export function param(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.slice(0, 200) : undefined;
}

export function oneOf<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  return value && (options as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function pageParam(value: string | undefined): number {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}
