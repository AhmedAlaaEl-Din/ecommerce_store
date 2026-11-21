"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "@/lib/admin/auth-service";
import { requireAdmin } from "@/lib/admin/guard";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session-rules";
import { db } from "@/lib/db";

/** Deletes the session row and the cookie. */
export async function logoutAction(): Promise<void> {
  const ctx = await requireAdmin();
  const jar = await cookies();
  await logout(db, jar.get(ADMIN_SESSION_COOKIE)?.value, ctx.user.id);
  jar.delete({ name: ADMIN_SESSION_COOKIE, path: "/admin" });
  redirect("/admin/login");
}
