/**
 * The authorization walk: every admin page, route handler and server action is
 * discovered from src/app/admin, must be classified below, must call
 * requireAdmin() in its source, and is then CALLED as an anonymous visitor, as
 * staff and as an admin:
 *   - anonymous  -> redirected to /admin/login (never runs)
 *   - staff      -> forbidden (403) wherever the target is admin-only
 *   - allowed    -> never redirected to login, never forbidden
 * A new admin file or exported action that is not in the tables fails the test.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/admin/password";
import { hashSessionToken, newSessionToken, SESSION_ABSOLUTE_MS } from "@/lib/admin/session-rules";
import { resetDb, testDb } from "./helpers";

// --- Next.js runtime stand-ins -------------------------------------------------
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "ng_admin" && jar.token ? { name, value: jar.token } : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers({ "x-forwarded-for": "10.9.9.9", host: "localhost" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

vi.mock("next/navigation", () => {
  class NavInterrupt extends Error {
    constructor(
      readonly kind: "redirect" | "forbidden" | "notFound",
      readonly to?: string,
    ) {
      super(`${kind}${to ? ` ${to}` : ""}`);
    }
  }
  return {
    redirect: (to: string) => {
      throw new NavInterrupt("redirect", to);
    },
    forbidden: () => {
      throw new NavInterrupt("forbidden");
    },
    notFound: () => {
      throw new NavInterrupt("notFound");
    },
    unstable_rethrow: () => undefined,
    usePathname: () => "/admin",
    useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
    useSearchParams: () => new URLSearchParams(),
  };
});

// --- Classification -------------------------------------------------------------
type Access = "public" | "staff" | "admin";

const PAGES: Record<string, Access> = {
  "login/page.tsx": "public",
  "(panel)/page.tsx": "staff",
  "(panel)/orders/page.tsx": "staff",
  "(panel)/orders/[id]/page.tsx": "staff",
  "(print)/orders/[id]/packing-slip/page.tsx": "staff",
  "(panel)/products/page.tsx": "staff",
  "(panel)/products/new/page.tsx": "admin",
  "(panel)/products/[id]/page.tsx": "staff",
  "(panel)/inventory/page.tsx": "staff",
  "(panel)/inventory/[id]/page.tsx": "staff",
  "(panel)/categories/page.tsx": "admin",
  "(panel)/categories/[id]/page.tsx": "admin",
  "(panel)/customers/page.tsx": "admin",
  "(panel)/users/page.tsx": "admin",
  "(panel)/audit/page.tsx": "admin",
};

const ROUTES: Record<string, Record<string, Access>> = {
  "(panel)/orders/export/route.ts": { GET: "admin" },
};

const ACTIONS: Record<string, Record<string, Access>> = {
  "actions.ts": { logoutAction: "staff" },
  "login/actions.ts": { loginAction: "public" },
  "(panel)/products/actions.ts": {
    createProductAction: "admin",
    updateProductAction: "admin",
    archiveProductAction: "admin",
    deleteProductAction: "admin",
  },
  "(panel)/inventory/actions.ts": {
    adjustStockAction: "staff",
    bulkStockAction: "staff",
    thresholdAction: "admin",
  },
  "(panel)/categories/actions.ts": {
    createCategoryAction: "admin",
    updateCategoryAction: "admin",
    deleteCategoryAction: "admin",
  },
  "(panel)/orders/actions.ts": {
    fulfilmentAction: "staff",
    addNoteAction: "staff",
    cancelOrderAction: "admin",
    refundOrderAction: "admin",
  },
  "(panel)/users/actions.ts": {
    inviteUserAction: "admin",
    changeRoleAction: "admin",
    setActiveAction: "admin",
  },
};

/** Layouts are not entry points, but they must not be the only check either. */
const LAYOUTS = ["layout.tsx", "(panel)/layout.tsx", "(print)/layout.tsx"];
/** Special files rendered by Next.js (no data, no actions). */
const SPECIAL = ["(panel)/forbidden.tsx", "(panel)/not-found.tsx"];

// --- Discovery --------------------------------------------------------------------
const ADMIN_DIR = join(process.cwd(), "src", "app", "admin");
const files = (readdirSync(ADMIN_DIR, { recursive: true }) as string[])
  .map((f) => f.split(sep).join("/"))
  .filter((f) => /\.(tsx?|mts)$/.test(f));

function source(rel: string) {
  return readFileSync(join(ADMIN_DIR, rel), "utf8");
}

function exportedFunctions(src: string): string[] {
  return [...src.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]!);
}

/** The body of `export async function name(...) { ... }` up to its first statement end. */
function firstStatement(src: string, name: string): string {
  const start = src.search(new RegExp(`export (?:default )?(?:async )?function ${name}\\b`));
  if (start < 0) throw new Error(`function ${name} not found`);
  const brace = src.indexOf("{", src.indexOf(")", start));
  return src.slice(brace + 1, src.indexOf(";", brace)).trim();
}

const db = testDb();
const sessions: Record<"staff" | "admin", () => Promise<string>> = {
  staff: async () => "",
  admin: async () => "",
};

beforeAll(async () => {
  await resetDb(db);
  const passwordHash = await hashPassword("walk-test-password-123");
  const staff = await db.adminUser.create({
    data: { email: "walk-staff@example.com", name: "Walk Staff", role: "staff", passwordHash },
  });
  const admin = await db.adminUser.create({
    data: { email: "walk-admin@example.com", name: "Walk Admin", role: "admin", passwordHash },
  });
  // A spare admin, so no "last active admin" rule interferes.
  await db.adminUser.create({
    data: { email: "walk-admin2@example.com", name: "Walk Admin 2", role: "admin", passwordHash },
  });
  const mint = (userId: string) => async () => {
    const token = newSessionToken();
    const now = new Date();
    await db.adminSession.create({
      data: {
        id: hashSessionToken(token),
        userId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
      },
    });
    return token;
  };
  sessions.staff = mint(staff.id);
  sessions.admin = mint(admin.id);
});

afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

type Outcome =
  | { kind: "redirect"; to: string }
  | { kind: "forbidden" }
  | { kind: "notFound" }
  | { kind: "ran" }
  | { kind: "error"; message: string };

async function run(fn: () => unknown): Promise<Outcome> {
  try {
    await fn();
    return { kind: "ran" };
  } catch (err) {
    const e = err as { kind?: string; to?: string; message?: string };
    if (e.kind === "redirect") return { kind: "redirect", to: e.to ?? "" };
    if (e.kind === "forbidden") return { kind: "forbidden" };
    if (e.kind === "notFound") return { kind: "notFound" };
    return { kind: "error", message: e.message ?? String(err) };
  }
}

async function as(who: "anon" | "staff" | "admin") {
  jar.token = who === "anon" ? undefined : await sessions[who]();
}

const pageProps = {
  params: Promise.resolve({ id: "does-not-exist" }),
  searchParams: Promise.resolve({}),
};

function argsFor(fn: (...a: never[]) => unknown): unknown[] {
  const fd = new FormData();
  fd.set("id", "does-not-exist");
  fd.set("orderId", "does-not-exist");
  fd.set("userId", "does-not-exist");
  fd.set("productId", "does-not-exist");
  if (fn.length >= 3) return ["does-not-exist", {}, fd];
  if (fn.length === 2) return [{}, fd];
  if (fn.length === 1) return [fd];
  return [];
}

async function load(rel: string) {
  return (await import(/* @vite-ignore */ pathToFileURL(join(ADMIN_DIR, rel)).href)) as Record<
    string,
    unknown
  >;
}

// --- Tests --------------------------------------------------------------------------
describe("admin authorization walk", () => {
  it("every admin file is classified (no unreviewed entry points)", () => {
    const known = new Set([
      ...Object.keys(PAGES),
      ...Object.keys(ROUTES),
      ...Object.keys(ACTIONS),
      ...LAYOUTS,
      ...SPECIAL,
    ]);
    const unknown = files.filter((f) => !known.has(f));
    expect(unknown, "classify these admin files in the walk test").toEqual([]);
    for (const f of known) expect(files, `missing file ${f}`).toContain(f);
    expect(files.filter((f) => f.endsWith("page.tsx")).sort()).toEqual(Object.keys(PAGES).sort());
    expect(files.filter((f) => f.endsWith("route.ts")).sort()).toEqual(Object.keys(ROUTES).sort());
  });

  it("every exported server action is classified", () => {
    for (const [rel, table] of Object.entries(ACTIONS)) {
      const src = source(rel);
      expect(src.startsWith('"use server"'), `${rel} is a server action module`).toBe(true);
      expect(exportedFunctions(src).sort(), rel).toEqual(Object.keys(table).sort());
    }
  });

  it("every protected entry point calls requireAdmin() first, with the right role", () => {
    const check = (rel: string, name: string, access: Access, src: string) => {
      const first = firstStatement(src, name);
      if (access === "public") {
        expect(first, `${rel} ${name}`).not.toMatch(/requireAdmin/);
        return;
      }
      const expected = access === "admin" ? 'await requireAdmin("admin")' : "await requireAdmin()";
      expect(first, `${rel} ${name} must start with ${expected}`).toContain(expected);
    };
    for (const [rel, access] of Object.entries(PAGES)) {
      const src = source(rel);
      const name = src.match(/export default (?:async )?function (\w+)/)?.[1];
      expect(name, `${rel} default export`).toBeTruthy();
      check(rel, name!, access, src);
    }
    for (const [rel, methods] of Object.entries(ROUTES)) {
      for (const [m, access] of Object.entries(methods)) check(rel, m, access, source(rel));
    }
    for (const [rel, table] of Object.entries(ACTIONS)) {
      for (const [name, access] of Object.entries(table)) check(rel, name, access, source(rel));
    }
    // The panel layout checks too (defence in depth), but never replaces the page checks above.
    expect(source("(panel)/layout.tsx")).toContain("await requireAdmin()");
  });

  describe("pages", () => {
    for (const [rel, access] of Object.entries(PAGES)) {
      if (access === "public") continue;
      it(`${rel}: anonymous -> login, staff -> ${access === "admin" ? "403" : "allowed"}, admin -> allowed`, async () => {
        const Page = (await load(rel)).default as (p: typeof pageProps) => unknown;
        await as("anon");
        expect(await run(() => Page(pageProps))).toEqual({ kind: "redirect", to: "/admin/login" });
        await as("staff");
        const staff = await run(() => Page(pageProps));
        if (access === "admin") expect(staff).toEqual({ kind: "forbidden" });
        else expect(["ran", "notFound"], JSON.stringify(staff)).toContain(staff.kind);
        await as("admin");
        const admin = await run(() => Page(pageProps));
        expect(["ran", "notFound"], JSON.stringify(admin)).toContain(admin.kind);
      });
    }
  });

  describe("route handlers", () => {
    for (const [rel, methods] of Object.entries(ROUTES)) {
      for (const [method, access] of Object.entries(methods)) {
        it(`${rel} ${method}: anonymous -> login, staff -> ${access === "admin" ? "403" : "allowed"}`, async () => {
          const handler = (await load(rel))[method] as (r: Request) => Promise<Response>;
          const req = () => new Request("http://localhost/admin/orders/export?status=paid");
          await as("anon");
          expect(await run(() => handler(req()))).toEqual({ kind: "redirect", to: "/admin/login" });
          await as("staff");
          expect(await run(() => handler(req()))).toEqual(
            access === "admin" ? { kind: "forbidden" } : { kind: "ran" },
          );
          await as("admin");
          expect(await run(() => handler(req()))).toEqual({ kind: "ran" });
        });
      }
    }
  });

  describe("server actions", () => {
    for (const [rel, table] of Object.entries(ACTIONS)) {
      for (const [name, access] of Object.entries(table)) {
        if (access === "public") continue;
        it(`${rel} ${name}: anonymous -> login, staff -> ${access === "admin" ? "403" : "allowed"}`, async () => {
          const fn = (await load(rel))[name] as (...a: unknown[]) => unknown;
          const auditBefore = await db.auditLog.count();
          await as("anon");
          expect(await run(() => fn(...argsFor(fn)))).toEqual({
            kind: "redirect",
            to: "/admin/login",
          });
          await as("staff");
          const staff = await run(() => fn(...argsFor(fn)));
          if (access === "admin") {
            expect(staff).toEqual({ kind: "forbidden" });
            // Refused before doing anything: nothing was written.
            expect(await db.auditLog.count()).toBe(auditBefore);
          } else if (name === "logoutAction") {
            // Logging out ends on the login page; prove it ran by the deleted session.
            expect(staff).toEqual({ kind: "redirect", to: "/admin/login" });
            expect(
              await db.adminSession.count({ where: { id: hashSessionToken(jar.token!) } }),
            ).toBe(0);
          } else {
            expect(staff.kind, JSON.stringify(staff)).not.toBe("forbidden");
            expect(staff).not.toEqual({ kind: "redirect", to: "/admin/login" });
          }
          await as("admin");
          const admin = await run(() => fn(...argsFor(fn)));
          expect(admin.kind, JSON.stringify(admin)).not.toBe("forbidden");
          if (name !== "logoutAction")
            expect(admin).not.toEqual({ kind: "redirect", to: "/admin/login" });
        });
      }
    }
  });

  it("an expired or unknown session counts as anonymous", async () => {
    const Page = (await load("(panel)/page.tsx")).default as (p: typeof pageProps) => unknown;
    jar.token = newSessionToken(); // well-formed but unknown
    expect(await run(() => Page(pageProps))).toEqual({ kind: "redirect", to: "/admin/login" });
    jar.token = "not-a-token";
    expect(await run(() => Page(pageProps))).toEqual({ kind: "redirect", to: "/admin/login" });
  });
});
