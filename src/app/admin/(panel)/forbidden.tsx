import Link from "next/link";
import { LockIcon } from "@/components/icons";

/** Rendered (with HTTP 403) when requireAdmin("admin") rejects a staff user. */
export default function AdminForbidden() {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center py-16 text-center"
      data-testid="forbidden"
    >
      <span className="bg-danger-soft text-danger inline-flex size-12 items-center justify-center rounded-full">
        <LockIcon size={22} />
      </span>
      <p className="text-danger mt-4 text-xs font-semibold tracking-[0.12em] uppercase">
        Error 403
      </p>
      <h1 className="mt-2 text-2xl">You don’t have access to this page</h1>
      <p className="text-muted mt-3">
        This part of the admin is for the Admin role. Ask an admin if you need it.
      </p>
      <Link
        href="/admin"
        className="text-primary mt-6 inline-flex min-h-11 items-center font-medium underline underline-offset-4"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
