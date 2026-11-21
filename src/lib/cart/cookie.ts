import "server-only";
import { cookies, headers } from "next/headers";
import { cartIdSchema } from "../schemas";

export const CART_COOKIE = "ng_cart";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Reads the cart id from the cookie. Malformed values are ignored. */
export async function readCartId(): Promise<string | null> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw) return null;
  const parsed = cartIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Whether to mark the cookie `Secure`. Decided by server configuration, never
 * by a header the client could send on its own:
 * - COOKIE_SECURE=true -> always Secure (Phase 4, served over HTTPS).
 * - TRUST_PROXY=true   -> Secure when the trusted reverse proxy reports https.
 * - default            -> not Secure, so plain http://localhost works in every browser.
 */
async function shouldUseSecureCookie(): Promise<boolean> {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.TRUST_PROXY === "true") {
    const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
    return proto === "https";
  }
  return false;
}

/** Writes (or refreshes, so expiry slides) the cart cookie: httpOnly, SameSite=Lax, 30 days. */
export async function writeCartId(cartId: string): Promise<void> {
  const secure = await shouldUseSecureCookie();
  (await cookies()).set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}
