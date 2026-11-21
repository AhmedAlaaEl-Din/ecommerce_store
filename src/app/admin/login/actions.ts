"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOGIN_FAILED_MESSAGE, LOGIN_THROTTLED_MESSAGE, login } from "@/lib/admin/auth-service";
import { adminCookieOptions } from "@/lib/admin/guard";
import { clientIp } from "@/lib/admin/request";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session-rules";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
});

/**
 * The one admin action that does not call requireAdmin(): it is how a session
 * starts. Server actions are Origin-checked by Next.js (CSRF), and the login
 * itself is rate limited per IP and per account.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email =
    typeof formData.get("email") === "string" ? String(formData.get("email")).slice(0, 254) : "";
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const jar = await cookies();
  let result;
  try {
    result = await login(db, {
      email: parsed.data.email,
      password: parsed.data.password,
      ip: clientIp(await headers()),
      previousToken: jar.get(ADMIN_SESSION_COOKIE)?.value,
    });
  } catch (err) {
    logError("admin-login", "login failed unexpectedly", err);
    return { error: "Sign-in is unavailable right now. Try again in a moment.", email };
  }
  if (!result.ok) {
    return {
      error: result.code === "THROTTLED" ? LOGIN_THROTTLED_MESSAGE : LOGIN_FAILED_MESSAGE,
      email,
    };
  }
  jar.set(ADMIN_SESSION_COOKIE, result.token, adminCookieOptions(result.expiresAt));
  redirect("/admin");
}
