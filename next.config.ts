import type { NextConfig } from "next";

// Cache Components is intentionally OFF in Phase 1: product pages must return a
// real HTTP 404 for unknown slugs, and with Cache Components the prerendered
// shell is streamed with a 200 before `notFound()` can run. The previous
// (dynamic-rendering) model is still fully supported in Next.js 16.
const isDev = process.env.NODE_ENV !== "production";

// Everything is served from this origin: no CDNs, analytics or third-party calls.
// Next.js inlines its bootstrap scripts, so script-src needs 'unsafe-inline'
// (a nonce-based CSP is a Phase 4 hardening item); dev also needs 'unsafe-eval'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

// Phase 3: the admin is never cached, never indexed and never framed, and
// sends no referrer (admin URLs contain order and product ids).
const adminHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
    ];
  },
  experimental: {
    // forbidden() renders app/admin/(panel)/forbidden.tsx with HTTP 403.
    authInterrupts: true,
    // Product image uploads (5 MB max, checked again in the action) plus
    // multipart overhead. Applies to every server action; see the Phase 3 report.
    serverActions: { bodySizeLimit: "6mb" },
  },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
