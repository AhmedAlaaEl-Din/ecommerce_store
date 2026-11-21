import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Self-hosted at build time by next/font (no runtime font CDN). Both are SIL OFL.
// Only the one weight the design uses (600) instead of the whole variable font:
// a smaller file on the critical path. The wordmark's italic is synthesised.
const display = Fraunces({
  subsets: ["latin"],
  weight: "600",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Only the document shell lives here. The store chrome (header, footer, cart
  // count) is in app/(store)/layout.tsx; checkout and the admin have their own.
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="bg-ink shadow-3 fixed top-2 left-2 z-[60] -translate-y-24 rounded-md px-4 py-3 font-medium text-white transition-transform duration-150 focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
