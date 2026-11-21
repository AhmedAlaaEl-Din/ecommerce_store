import type { Metadata } from "next";

// Admin pages are never indexed (plus an X-Robots-Tag header in next.config.ts)
// and are not linked from the storefront.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Nile Goods admin" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-background text-ink flex min-h-dvh flex-col">{children}</div>;
}
