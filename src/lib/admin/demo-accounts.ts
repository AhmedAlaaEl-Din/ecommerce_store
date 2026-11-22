/**
 * Demo admin accounts for the seed. Their passwords are random and written
 * ONLY to var/demo-credentials.txt (git-ignored). If that file already exists
 * its passwords are reused, so the dev, e2e and demo-frame databases all accept
 * the same credentials. Passwords are never printed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Db } from "../db";
import { generatePassword, hashPassword } from "./password";
import type { AdminRole } from "./roles";

export const DEMO_ACCOUNTS: ReadonlyArray<{ email: string; name: string; role: AdminRole }> = [
  { email: "admin@example.com", name: "Amira Admin (demo)", role: "admin" },
  { email: "staff@example.com", name: "Sami Staff (demo)", role: "staff" },
];

export function credentialsPath(root = process.cwd()): string {
  return join(root, "var", "demo-credentials.txt");
}

/** Parses "email  password" lines; ignores comments and blank lines. */
export function parseCredentials(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [email, password] = t.split(/\s+/);
    if (email && password) out.set(email.toLowerCase(), password);
  }
  return out;
}

export function readDemoCredentials(root = process.cwd()): Map<string, string> {
  const p = credentialsPath(root);
  return existsSync(p) ? parseCredentials(readFileSync(p, "utf8")) : new Map();
}

/** Creates or updates the two demo accounts. Returns whether the file was (re)written. */
export async function seedDemoAccounts(db: Db, root = process.cwd()): Promise<{ wrote: boolean }> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_ACCOUNTS !== "true") {
    throw new Error("Refusing to seed demo admin accounts in production.");
  }
  const existing = readDemoCredentials(root);
  const creds = new Map<string, string>();
  for (const a of DEMO_ACCOUNTS) creds.set(a.email, existing.get(a.email) ?? generatePassword());

  for (const a of DEMO_ACCOUNTS) {
    const passwordHash = await hashPassword(creds.get(a.email)!);
    await db.$transaction(async (tx) => {
      await tx.adminUser.upsert({
        where: { email: a.email },
        create: { email: a.email, name: a.name, role: a.role, passwordHash },
        update: {
          name: a.name,
          role: a.role,
          passwordHash,
          isActive: true,
          failedLogins: 0,
          lockedUntil: null,
        },
      });
    });
  }

  const wrote = DEMO_ACCOUNTS.some((a) => existing.get(a.email) !== creds.get(a.email));
  if (wrote) {
    const p = credentialsPath(root);
    mkdirSync(dirname(p), { recursive: true });
    const lines = [
      "# Nile Goods demo admin accounts (local only; this file is git-ignored).",
      "# Sign in at http://localhost:3000/admin/login",
      ...DEMO_ACCOUNTS.map((a) => `${a.email}  ${creds.get(a.email)}  (${a.role})`),
      "",
    ];
    writeFileSync(p, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  }
  return { wrote };
}
