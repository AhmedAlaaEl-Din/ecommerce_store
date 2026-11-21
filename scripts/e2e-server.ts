/**
 * Starts the production server for Playwright on a fresh, separate database
 * (prisma/e2e.db), so end-to-end runs never touch prisma/dev.db.
 * Requires a production build (`npm run build`); builds one if missing.
 */
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const port = process.env.E2E_PORT ?? "3100";
// Validated before it is used anywhere (it ends up in a shell command below).
if (!/^[0-9]{2,5}$/.test(port)) throw new Error(`Invalid E2E_PORT: ${port}`);
const env = {
  ...process.env,
  DATABASE_URL: "file:./prisma/e2e.db",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  APP_URL: `http://localhost:${port}`,
  // Phase 2: the production build runs with the offline mock payment provider.
  PAYMENT_PROVIDER: "mock",
  ALLOW_MOCK_PAYMENTS: "true",
  MOCK_WEBHOOK_SECRET: randomBytes(32).toString("hex"),
  MOCK_WEBHOOK_DELAY_MS: process.env.MOCK_WEBHOOK_DELAY_MS ?? "1500",
  OUTBOX_DIR: process.env.OUTBOX_DIR ?? "var/outbox-e2e",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
};

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(join(root, "prisma", `e2e.db${suffix}`), { force: true });
}
rmSync(join(root, env.OUTBOX_DIR), { recursive: true, force: true });
execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "pipe" });
execSync("npx tsx prisma/seed.ts --reset-carts", { cwd: root, env, stdio: "inherit" });

if (!existsSync(join(root, ".next", "BUILD_ID"))) {
  execSync("npx next build", { cwd: root, env, stdio: "inherit" });
}

// Single command string (port validated above), run through the shell for Windows npx.
const server = spawn(`npx next start --hostname localhost --port ${port}`, {
  cwd: root,
  env,
  stdio: "inherit",
  shell: true,
});
const stop = () => {
  // On Windows the shell wrapper would otherwise leave "next start" running.
  if (process.platform === "win32" && server.pid) {
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill();
  }
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
