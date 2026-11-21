/**
 * Admin user management (admin only). Guards: nobody can disable or demote
 * themselves, and the system always keeps at least one active admin.
 */
import type { Db } from "../db";
import { maskEmail } from "../log";
import { assertCan, fail, type Actor } from "./actor";
import { writeAudit, type Tx } from "./audit";
import { createAdminUser } from "./auth-service";
import type { AdminRole } from "./roles";

export async function listUsers(db: Db) {
  return db.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
    },
  });
}

export async function inviteUser(
  db: Db,
  actor: Actor,
  input: { email: string; name: string; role: AdminRole },
) {
  assertCan(actor, "users.manage");
  const res = await createAdminUser(db, { ...input, actorId: actor.id });
  if (!res.ok) {
    return fail(
      res.code === "EMAIL_TAKEN"
        ? "An account with that email already exists."
        : "Enter a valid email address.",
    );
  }
  return {
    ok: true as const,
    value: { id: res.user.id, email: res.user.email, password: res.password },
  };
}

async function otherActiveAdmins(tx: Tx, excludeId: string) {
  return tx.adminUser.count({ where: { role: "admin", isActive: true, id: { not: excludeId } } });
}

export async function changeRole(db: Db, actor: Actor, userId: string, role: AdminRole) {
  assertCan(actor, "users.manage");
  if (userId === actor.id) return fail("You can't change your own role.");
  return db.$transaction(async (tx) => {
    const u = await tx.adminUser.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, email: true },
    });
    if (!u) return fail("That user no longer exists.");
    if (u.role === role) return { ok: true as const };
    if (u.role === "admin" && u.isActive && (await otherActiveAdmins(tx, userId)) === 0) {
      return fail("At least one active admin is required.");
    }
    await tx.adminUser.update({ where: { id: userId }, data: { role } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "user.role_change",
      entityType: "AdminUser",
      entityId: userId,
      summary: { email: maskEmail(u.email), role: [u.role, role] },
    });
    return { ok: true as const };
  });
}

export async function setUserActive(db: Db, actor: Actor, userId: string, active: boolean) {
  assertCan(actor, "users.manage");
  if (userId === actor.id && !active) return fail("You can't disable your own account.");
  return db.$transaction(async (tx) => {
    const u = await tx.adminUser.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, email: true },
    });
    if (!u) return fail("That user no longer exists.");
    if (u.isActive === active) return { ok: true as const };
    if (!active && u.role === "admin" && (await otherActiveAdmins(tx, userId)) === 0) {
      return fail("At least one active admin is required.");
    }
    await tx.adminUser.update({
      where: { id: userId },
      data: active ? { isActive: true, failedLogins: 0, lockedUntil: null } : { isActive: false },
    });
    // A disabled user is signed out everywhere at once.
    if (!active) await tx.adminSession.deleteMany({ where: { userId } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: active ? "user.enable" : "user.disable",
      entityType: "AdminUser",
      entityId: userId,
      summary: { email: maskEmail(u.email) },
    });
    return { ok: true as const };
  });
}
