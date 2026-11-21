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
 * Writes (or refreshes) the cart cookie: httpOnly, SameSite=Lax, 30 days.
 * `Secure` is set whenever the request came in over HTTPS (e.g. behind the
 * Phase 4 nginx proxy); plain http://localhost keeps working in every browser.
 */
export async function writeCartId(cartId: string): Promise<void> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  (await cookies()).set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}
