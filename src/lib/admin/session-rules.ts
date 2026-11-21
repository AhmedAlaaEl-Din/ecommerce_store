/** Pure session rules (unit-tested): token format, hashing and expiry. */
import { createHash, randomBytes } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ng_admin";
export const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // 12 hours
/** lastSeenAt is written at most this often (keeps reads cheap). */
export const SESSION_TOUCH_MS = 60 * 1000;

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** 256-bit random token for the cookie. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isSessionTokenShape(token: string | undefined | null): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

/** Only the hash is stored, so a database leak does not hand out live sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionTimes = { createdAt: Date; lastSeenAt: Date; expiresAt: Date };
export type SessionState = "valid" | "idle_expired" | "absolute_expired";

export function sessionState(s: SessionTimes, now: Date): SessionState {
  if (now.getTime() >= s.expiresAt.getTime()) return "absolute_expired";
  if (now.getTime() - s.lastSeenAt.getTime() >= SESSION_IDLE_MS) return "idle_expired";
  return "valid";
}

export function shouldTouch(s: Pick<SessionTimes, "lastSeenAt">, now: Date): boolean {
  return now.getTime() - s.lastSeenAt.getTime() >= SESSION_TOUCH_MS;
}

export function absoluteExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_ABSOLUTE_MS);
}

/** After a failed login: the new failure count and, at the threshold, when the lock ends. */
export function afterFailedLogin(
  failedLogins: number,
  now: Date,
): { failedLogins: number; lockedUntil: Date | null } {
  const next = failedLogins + 1;
  if (next >= LOCKOUT_THRESHOLD) {
    return { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MS) };
  }
  return { failedLogins: next, lockedUntil: null };
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}
