/**
 * Password hashing (argon2id via @node-rs/argon2, prebuilt for Windows) and the
 * password policy. Passwords are never logged or stored in plain text.
 */
import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

// OWASP's argon2id baseline: 19 MiB memory, 2 iterations, 1 lane.
const ARGON2_OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON = new Set([
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "adminadmin12",
  "letmein12345",
  "passwordpassword",
  "nilegoods123",
  "changeme1234",
]);

export type PolicyResult = { ok: true } | { ok: false; message: string };

/** Length 12–128, not a well-known password, not the email, not one repeated character. */
export function checkPasswordPolicy(password: string, email?: string): PolicyResult {
  if (password.length < PASSWORD_MIN_LENGTH)
    return { ok: false, message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  if (password.length > PASSWORD_MAX_LENGTH)
    return { ok: false, message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` };
  if (COMMON.has(password.toLowerCase()))
    return { ok: false, message: "That password is too common." };
  if (/^(.)\1+$/.test(password))
    return { ok: false, message: "Don't repeat a single character." };
  if (email && password.toLowerCase().includes(email.toLowerCase().split("@")[0]!) && email.split("@")[0]!.length >= 4)
    return { ok: false, message: "Don't use your email address in the password." };
  return { ok: true };
}

/** A random 24-character password (144 bits), shown once to whoever creates the account. */
export function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Verifies against a throwaway hash so a login for an unknown email takes as
 * long as one for a real account (no user enumeration through timing).
 */
export async function burnVerifyTime(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(await dummyHash, password);
}
