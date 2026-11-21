import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { unstable_rethrow } from "next/navigation";
import { CartCountProvider } from "@/components/cart/CartCountProvider";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ToastProvider } from "@/components/ui/Toast";
import { getCategories } from "@/lib/catalog";
import { readCartId } from "@/lib/cart/cookie";
import { getCartItemCount } from "@/lib/cart/service";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Self-hosted at build time by next/font (no runtime font CDN). Both are SIL OFL.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

const text = DM_Sans({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nile Goods: well-made things for everyday living",
    template: "%s · Nile Goods",
  },
  description:
    "Ceramics, linen, paper and bags chosen to be used every day. Nile Goods is a demo store for a portfolio project; no real orders.",
  applicationName: "Nile Goods",
  openGraph: {
    siteName: "Nile Goods",
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F3EC",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The layout renders around error.tsx, so a database failure here must not
  // take the whole page down: fall back to an empty nav/cart and let the page
  // itself show a friendly error if it also cannot load.
  const [categories, cartCount] = await Promise.all([
    getCategories().catch((err: unknown) => {
      unstable_rethrow(err); // let Next.js internal signals (dynamic usage, redirects) through
      console.error("[layout] categories failed:", err instanceof Error ? err.message : err);
      return [];
    }),
    readCartId()
      .then((id) => getCartItemCount(db, id))
      .catch((err: unknown) => {
        unstable_rethrow(err);
        console.error("[layout] cart count failed:", err instanceof Error ? err.message : err);
        return 0;
      }),
  ]);
  const nav = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="bg-ink shadow-3 fixed top-2 left-2 z-[60] -translate-y-24 rounded-md px-4 py-3 font-medium text-white transition-transform duration-150 focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        <CartCountProvider initialCount={cartCount}>
          <ToastProvider>
            <SiteHeader categories={nav} />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <SiteFooter categories={nav} />
          </ToastProvider>
        </CartCountProvider>
      </body>
    </html>
  );
}
