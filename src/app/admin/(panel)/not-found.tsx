import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center py-16 text-center"
      data-testid="admin-not-found"
    >
      <p className="text-accent text-xs font-semibold tracking-[0.12em] uppercase">Error 404</p>
      <h1 className="mt-2 text-2xl">Not found</h1>
      <p className="text-muted mt-3">That record doesn’t exist, or it was removed.</p>
      <Link
        href="/admin"
        className="text-primary mt-6 inline-flex min-h-11 items-center font-medium underline underline-offset-4"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
