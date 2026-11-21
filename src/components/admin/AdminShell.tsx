import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/roles";
import { ExternalIcon, LogOutIcon } from "../icons";
import { AdminDrawer } from "./AdminDrawer";
import { AdminNav } from "./AdminNav";
import { navFor } from "./nav-items";

function LogoutButton({ testId }: { testId: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        data-testid={testId}
        className="text-ink/80 hover:bg-sunken hover:text-ink flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium lg:min-h-10"
      >
        <LogOutIcon size={18} />
        Log out
      </button>
    </form>
  );
}

/** Back-office layout: sidebar on desktop, drawer on mobile, top bar with the signed-in user. */
export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: AdminRole };
  children: React.ReactNode;
}) {
  const items = navFor(user.role);
  return (
    <div className="flex min-h-dvh">
      <aside className="border-line bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r lg:flex">
        <div className="border-line flex h-14 items-center border-b px-5">
          <span className="font-display text-lg font-semibold tracking-[-0.02em]">
            Nile <span className="text-accent italic">Goods</span>
          </span>
          <span className="text-muted ml-2 text-xs font-semibold tracking-[0.08em] uppercase">
            Admin
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav items={items} />
        </div>
        <div className="border-line border-t p-3">
          <LogoutButton testId="logout" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          <AdminDrawer items={items} footer={<LogoutButton testId="logout-mobile" />} />
          <span className="font-display text-lg font-semibold lg:hidden">Admin</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="text-muted hover:text-ink hidden min-h-11 items-center gap-1 sm:inline-flex"
            >
              View store <ExternalIcon size={16} />
            </Link>
            <span className="bg-line hidden h-5 w-px sm:block" aria-hidden="true" />
            <span className="flex items-center gap-2" data-testid="admin-user">
              <span className="hidden max-w-48 truncate font-medium sm:inline">{user.name}</span>
              <span
                className={
                  user.role === "admin"
                    ? "bg-primary-soft text-primary rounded-sm px-2 py-0.5 text-xs font-semibold"
                    : "bg-sunken text-ink rounded-sm px-2 py-0.5 text-xs font-semibold"
                }
                data-testid="admin-role"
              >
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
