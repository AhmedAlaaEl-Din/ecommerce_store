/**
 * Starts the production server for Playwright on a fresh, separate database
 * (prisma/e2e.db), so end-to-end runs never touch prisma/dev.db.
 * Requires a production build (`npm run build`); builds one if missing.
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const port = process.env.E2E_PORT ?? "3100";
const env = {
  ...process.env,
  DATABASE_URL: "file:./prisma/e2e.db",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
};

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(join(root, "prisma", `e2e.db${suffix}`), { force: true });
}
execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "pipe" });
execSync("npx tsx prisma/seed.ts --reset-carts", { cwd: root, env, stdio: "inherit" });

if (!existsSync(join(root, ".next", "BUILD_ID"))) {
  execSync("npx next build", { cwd: root, env, stdio: "inherit" });
}

// Single command string (port is validated below), run through the shell for Windows npx.
if (!/^[0-9]{2,5}$/.test(port)) throw new Error(`Invalid E2E_PORT: ${port}`);
const server = spawn(`npx next start --hostname localhost --port ${port}`, {
  cwd: root,
  env,
  stdio: "inherit",
  shell: true,
});
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
