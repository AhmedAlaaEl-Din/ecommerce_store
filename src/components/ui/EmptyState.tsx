import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
  illustration,
  headingLevel = 2,
  testId,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  illustration?: ReactNode;
  headingLevel?: 1 | 2;
  testId?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div
      data-testid={testId}
      className="border-line-strong/40 bg-surface mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center"
    >
      {illustration ?? <EmptyBagIllustration />}
      <Heading className="mt-6 text-xl">{title}</Heading>
      {children && <div className="text-muted mt-2">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function EmptyBagIllustration() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true">
      <circle cx="60" cy="46" r="40" fill="#F3E1D5" />
      <ellipse cx="60" cy="84" rx="30" ry="4" fill="#1F2A24" opacity="0.1" />
      <path d="M38 38h44l-4 42H42l-4-42Z" fill="#D8B98F" />
      <path d="M60 38h22l-4 42H60V38Z" fill="#1F2A24" opacity="0.1" />
      <path
        d="M50 38v-6a10 10 0 0 1 20 0v6"
        fill="none"
        stroke="#1F2A24"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
