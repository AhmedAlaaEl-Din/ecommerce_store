/**
 * Creates an admin account and prints a one-time random password.
 *
 *   npm run admin:create -- --email someone@example.com --role admin [--name "Someone"]
 *
 * The password is printed once to this terminal only; it is not stored anywhere
 * in plain text. Sign in at /admin/login with it.
 */
import "dotenv/config";
import { createAdminUser } from "../src/lib/admin/auth-service";
import { isAdminRole } from "../src/lib/admin/roles";
import { createDb } from "../src/lib/db";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const role = arg("role") ?? "staff";
  const name = arg("name") ?? "";
  if (!email || !isAdminRole(role)) {
    console.error(
      'Usage: npm run admin:create -- --email someone@example.com --role admin|staff [--name "Name"]',
    );
    process.exit(2);
  }
  const db = createDb();
  try {
    const res = await createAdminUser(db, { email, name, role, actorId: null });
    if (!res.ok) {
      console.error(
        res.code === "EMAIL_TAKEN"
          ? "An account with that email already exists."
          : "That email address doesn't look valid.",
      );
      process.exit(1);
    }
    console.log(`Created ${res.user.role} account ${res.user.email}.`);
    console.log("One-time password (shown only now, copy it somewhere safe):");
    console.log(`  ${res.password}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
