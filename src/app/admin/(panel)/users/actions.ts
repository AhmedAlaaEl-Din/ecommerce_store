"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { isAdminRole } from "@/lib/admin/roles";
import { changeRole, inviteUser, setUserActive } from "@/lib/admin/users";
import { db } from "@/lib/db";

export type InviteState = {
  error?: string;
  /** Shown once, right after creating the account; never stored or logged. */
  created?: { email: string; password: string };
};

const inviteSchema = z.object({
  email: z.string().trim().min(3).max(254),
  name: z.string().trim().max(80),
  role: z.string(),
});

export async function inviteUserAction(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const { user } = await requireAdmin("admin");
  const parsed = inviteSchema.safeParse({
    email: fd.get("email") ?? "",
    name: fd.get("name") ?? "",
    role: fd.get("role") ?? "",
  });
  if (!parsed.success || !isAdminRole(parsed.data.role)) return { error: "Enter an email and choose a role." };
  const res = await inviteUser(db, user, { email: parsed.data.email, name: parsed.data.name, role: parsed.data.role });
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin/users");
  return { created: { email: res.value.email, password: res.value.password } };
}

export async function changeRoleAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const role = String(fd.get("role") ?? "");
  const res = isAdminRole(role)
    ? await changeRole(db, user, String(fd.get("userId") ?? ""), role)
    : { ok: false as const, error: "" };
  redirect(`/admin/users?done=${res.ok ? "role" : "role_refused"}`);
}

export async function setActiveAction(fd: FormData): Promise<void> {
  const { user } = await requireAdmin("admin");
  const active = fd.get("active") === "1";
  const res = await setUserActive(db, user, String(fd.get("userId") ?? ""), active);
  redirect(`/admin/users?done=${res.ok ? (active ? "enabled" : "disabled") : "active_refused"}`);
}
