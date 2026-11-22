/**
 * Client IP for rate limiting. The LAST x-forwarded-for hop is the one our own
 * server or trusted proxy appended; earlier hops are client-controlled and
 * must not choose the rate-limit bucket.
 */
export function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}
