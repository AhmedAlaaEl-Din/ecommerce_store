import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();
  return <h1 className="text-2xl">Dashboard for {user.name}</h1>;
}
