"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

/** Friendly fallback for unexpected render errors. The raw error is never shown. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 pt-20 pb-8 text-center">
      <p className="text-accent text-xs font-semibold tracking-[0.12em] uppercase">
        Something went wrong
      </p>
      <h1 className="mt-3 text-2xl sm:text-3xl">We dropped something on our side</h1>
      <p className="text-muted mt-4 text-lg">
        Please try again. If it keeps happening, head back to the shop and start from there.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <ButtonLink href="/" size="lg" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}
