/**
 * requireAdmin(): the ONE authorization helper. Every admin page, server action
 * and route handler calls it first (a test walks them all). The admin layout
 * also calls it, but a layout alone is not a check: pages, actions and route
 * handlers are separately addressable.
 *
 * - No valid session  -> redirect to /admin/login
 * - Wrong role        -> forbidden() (403 page)
 */
import "server-only";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { resolveSession, type SessionContext } from "./auth-service";
import type { AdminRole } from "./roles";
import { ADMIN_SESSION_COOKIE } from "./session-rules";

export type AdminContext = SessionContext;

/** The signed-in admin user for this request, or null. Cached per request. */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return resolveSession(db, token);
});

/**
 * Requires a signed-in admin user. `requireAdmin()` accepts any role;
 * `requireAdmin("admin")` accepts admins only.
 */
export async function requireAdmin(role?: AdminRole): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (role === "admin" && ctx.user.role !== "admin") forbidden();
  return ctx;
}

/** Cookie options: httpOnly, SameSite=Lax, path /admin, Secure in production. */
export function adminCookieOptions(expiresAt: Date) {
  const secure =
    process.env.NODE_ENV === "production" && process.env.ADMIN_COOKIE_SECURE !== "false";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/admin",
    expires: expiresAt,
  };
}
