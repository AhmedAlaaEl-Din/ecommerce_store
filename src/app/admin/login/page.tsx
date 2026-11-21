import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminContext } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  if (await getAdminContext()) redirect("/admin");
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center px-4 py-12 focus:outline-none"
    >
      <div className="w-full max-w-sm">
        <p className="font-display text-center text-[1.375rem] font-semibold tracking-[-0.02em]">
          Nile <span className="text-accent italic">Goods</span>
        </p>
        <div className="border-line bg-surface shadow-1 mt-6 rounded-lg border p-6 sm:p-8">
          <h1 className="text-xl">Sign in to the admin</h1>
          <p className="text-muted mt-1 text-sm">For store staff. Demo data only.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
