/** Base URL for canonical and Open Graph links (inlined at build time). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Absolute base URL used at RUNTIME on the server: payment return URLs,
 * redirects and links in confirmation emails. Read from APP_URL when the
 * server starts (NEXT_PUBLIC_* values are frozen into the build), falling back
 * to the build-time SITE_URL. Never derived from the request's Host header.
 */
export function appUrl(): string {
  const raw = process.env.APP_URL?.trim();
  return (raw || SITE_URL).replace(/\/+$/, "");
}
