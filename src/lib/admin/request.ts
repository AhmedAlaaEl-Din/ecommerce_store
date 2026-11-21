/**
 * Client IP for rate limiting. Next.js's server sets x-forwarded-for from the
 * socket address; behind the Phase 4 proxy the first hop is the client.
 */
export function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}
