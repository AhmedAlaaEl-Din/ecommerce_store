/**
 * Admin authentication against the database. Framework-free (takes a Prisma
 * client and plain values) so integration tests can drive it directly; the
 * cookie and redirect handling lives in ./guard.ts.
 */
import type { Db } from "../db";
import { maskEmail } from "../log";
import { RateLimiter } from "../rate-limit";
import { writeAudit } from "./audit";
import {
  burnVerifyTime,
  checkPasswordPolicy,
  generatePassword,
  hashPassword,
  verifyPassword,
} from "./password";
import type { AdminRole } from "./roles";
import {
  absoluteExpiry,
  afterFailedLogin,
  hashSessionToken,
  isLocked,
  isSessionTokenShape,
  newSessionToken,
  sessionState,
  shouldTouch,
} from "./session-rules";

export type AdminUserView = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

const globalForLimits = globalThis as unknown as {
  __nileLoginLimits?: { ip: RateLimiter; account: RateLimiter };
};
/**
 * Per IP: burst of 20, then one every 3 s. Per account (keyed by the typed
 * email, existing or not, so it reveals nothing): burst of 8, then one a minute.
 * The 5-failure lockout below is the main defence; these stop spraying.
 */
export const loginLimits = (globalForLimits.__nileLoginLimits ??= {
  ip: new RateLimiter(20, 1 / 3),
  account: new RateLimiter(8, 1 / 60),
});

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const LOGIN_FAILED_MESSAGE =
  "That email and password don't match an active account. After 5 failed tries an account is locked for 15 minutes.";
export const LOGIN_THROTTLED_MESSAGE = "Too many sign-in attempts. Wait a minute and try again.";

export type LoginInput = {
  email: string;
  password: string;
  ip: string;
  /** Token from the existing cookie, if any: deleted on success (session rotation). */
  previousToken?: string | null;
  now?: Date;
};

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; user: AdminUserView }
  | { ok: false; code: "INVALID" | "THROTTLED" };

export async function login(db: Db, input: LoginInput): Promise<LoginResult> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email).slice(0, 254);
  const masked = maskEmail(email);

  if (!loginLimits.ip.take(`ip:${input.ip}`) || !loginLimits.account.take(`acct:${email}`)) {
    await db.$transaction((tx) =>
      writeAudit(tx, {
        actorId: null,
        action: "auth.login_throttled",
        entityType: "AdminUser",
        summary: { email: masked },
        now,
      }),
    );
    return { ok: false, code: "THROTTLED" };
  }

  const user = await db.adminUser.findUnique({ where: { email } });

  const fail = async (reason: string, userId: string | null, lock?: boolean) => {
    await db.$transaction(async (tx) => {
      if (userId && lock !== undefined) {
        // Re-read inside the transaction so concurrent failures all count.
        const fresh = await tx.adminUser.findUnique({
          where: { id: userId },
          select: { failedLogins: true },
        });
        const next = afterFailedLogin(fresh?.failedLogins ?? 0, now);
        await tx.adminUser.update({ where: { id: userId }, data: next });
        if (next.lockedUntil) {
          await writeAudit(tx, {
            actorId: null,
            action: "auth.account_locked",
            entityType: "AdminUser",
            entityId: userId,
            summary: { email: masked, minutes: 15 },
            now,
          });
        }
      }
      await writeAudit(tx, {
        actorId: null,
        action: "auth.login_failed",
        entityType: "AdminUser",
        entityId: userId,
        summary: { email: masked, reason },
        now,
      });
    });
    return { ok: false as const, code: "INVALID" as const };
  };

  if (!user) {
    await burnVerifyTime(input.password);
    return fail("unknown_email", null);
  }
  if (!user.isActive) {
    await burnVerifyTime(input.password);
    return fail("disabled", user.id);
  }
  if (isLocked(user.lockedUntil, now)) {
    await burnVerifyTime(input.password);
    return fail("locked", user.id);
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    return fail("wrong_password", user.id, true);
  }

  const token = newSessionToken();
  const expiresAt = absoluteExpiry(now);
  await db.$transaction(async (tx) => {
    // Rotation: whatever session id the browser had before is discarded.
    if (isSessionTokenShape(input.previousToken)) {
      await tx.adminSession.deleteMany({ where: { id: hashSessionToken(input.previousToken) } });
    }
    await tx.adminSession.create({
      data: {
        id: hashSessionToken(token),
        userId: user.id,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
      },
    });
    await tx.adminUser.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
    });
    // Housekeeping: drop this user's expired sessions.
    await tx.adminSession.deleteMany({ where: { userId: user.id, expiresAt: { lt: now } } });
    await writeAudit(tx, {
      actorId: user.id,
      action: "auth.login_success",
      entityType: "AdminUser",
      entityId: user.id,
      summary: { email: masked },
      now,
    });
  });
  return {
    ok: true,
    token,
    expiresAt,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export type SessionContext = {
  sessionId: string;
  user: AdminUserView;
  expiresAt: Date;
};

/**
 * Resolves a cookie token to a signed-in, active user. Expired sessions
 * (30 min idle, 12 h absolute) are deleted. lastSeenAt slides at most once a minute.
 */
export async function resolveSession(
  db: Db,
  token: string | null | undefined,
  now = new Date(),
): Promise<SessionContext | null> {
  if (!isSessionTokenShape(token)) return null;
  const id = hashSessionToken(token);
  const session = await db.adminSession.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true } } },
  });
  if (!session) return null;
  const state = sessionState(session, now);
  if (state !== "valid" || !session.user.isActive) {
    await db.$transaction((tx) => tx.adminSession.deleteMany({ where: { id } }));
    return null;
  }
  if (shouldTouch(session, now)) {
    await db.$transaction((tx) =>
      tx.adminSession.updateMany({ where: { id }, data: { lastSeenAt: now } }),
    );
  }
  const { isActive: _active, ...user } = session.user;
  void _active;
  return { sessionId: id, user, expiresAt: session.expiresAt };
}

export async function logout(db: Db, token: string | null | undefined, actorId: string | null) {
  if (!isSessionTokenShape(token)) return;
  await db.$transaction(async (tx) => {
    await tx.adminSession.deleteMany({ where: { id: hashSessionToken(token) } });
    if (actorId) {
      await writeAudit(tx, {
        actorId,
        action: "auth.logout",
        entityType: "AdminUser",
        entityId: actorId,
      });
    }
  });
}

export type CreateUserResult =
  | { ok: true; user: AdminUserView; password: string }
  | { ok: false; code: "EMAIL_TAKEN" | "INVALID_EMAIL" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates an admin user with a one-time random password (returned once, to be
 * shown to whoever creates the account). `actorId` null means the CLI.
 */
export async function createAdminUser(
  db: Db,
  input: { email: string; name: string; role: AdminRole; actorId: string | null; password?: string },
): Promise<CreateUserResult> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, code: "INVALID_EMAIL" };
  const password = input.password ?? generatePassword();
  const policy = checkPasswordPolicy(password, email);
  if (!policy.ok) throw new Error(`Password policy: ${policy.message}`);
  const passwordHash = await hashPassword(password);
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: { email, name: input.name.trim() || email.split("@")[0]!, role: input.role, passwordHash },
        select: { id: true, email: true, name: true, role: true },
      });
      await writeAudit(tx, {
        actorId: input.actorId,
        action: "user.create",
        entityType: "AdminUser",
        entityId: created.id,
        summary: { email: maskEmail(email), role: input.role, via: input.actorId ? "admin" : "cli" },
      });
      return created;
    });
    return { ok: true, user, password };
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return { ok: false, code: "EMAIL_TAKEN" };
    throw err;
  }
}
