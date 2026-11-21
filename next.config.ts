import type { NextConfig } from "next";

// Cache Components is intentionally OFF in Phase 1: product pages must return a
// real HTTP 404 for unknown slugs, and with Cache Components the prerendered
// shell is streamed with a 200 before `notFound()` can run. The previous
// (dynamic-rendering) model is still fully supported in Next.js 16.
const nextConfig: NextConfig = {
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
