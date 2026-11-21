import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/guard";

/** Every page below also calls requireAdmin() itself; this check is only for the shell. */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return <AdminShell user={user}>{children}</AdminShell>;
}
