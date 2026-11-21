import type { Metadata } from "next";
import { ArrowRightIcon } from "@/components/icons";
import { StoreChrome } from "@/components/layout/StoreChrome";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Page not found",
  description: "We couldn’t find that page at Nile Goods.",
};

export default function NotFound() {
  // Unmatched URLs render outside the (store) layout, so the chrome is added here.
  return (
    <StoreChrome>
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 pt-16 pb-8 text-center sm:px-6 lg:px-10 lg:pt-24">
        <svg width="220" height="160" viewBox="0 0 220 160" aria-hidden="true">
          <circle cx="110" cy="80" r="72" fill="#F3E1D5" />
          <ellipse cx="110" cy="146" rx="60" ry="6" fill="#1F2A24" opacity="0.1" />
          <path
            d="M86 54h48v12c0 10-6 14-6 22 0 12 24 22 24 44 0 8-6 14-14 14H82c-8 0-14-6-14-14 0-22 24-32 24-44 0-8-6-12-6-22V54Z"
            fill="#C0754A"
          />
          <path
            d="M110 54h24v12c0 10-6 14-6 22 0 12 24 22 24 44 0 8-6 14-14 14h-28V54Z"
            fill="#1F2A24"
            opacity="0.12"
          />
          <rect x="82" y="48" width="56" height="10" rx="5" fill="#9C5A36" />
          <path
            d="M74 118c20-6 52-6 72 0"
            stroke="#FBF6EE"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
        </svg>
        <p className="text-accent mt-8 text-xs font-semibold tracking-[0.12em] uppercase">
          Error 404
        </p>
        <h1 className="mt-3 max-w-xl text-2xl sm:text-3xl">This page wandered off the shelf</h1>
        <p className="text-muted mt-4 max-w-md text-lg">
          The link may be old, or the product may no longer be in our edit. Let’s get you back to
          something good.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/" size="lg">
            Back to home
          </ButtonLink>
          <ButtonLink href="/products" size="lg" variant="secondary">
            Browse all products
            <ArrowRightIcon size={18} />
          </ButtonLink>
        </div>
      </div>
    </StoreChrome>
  );
}
