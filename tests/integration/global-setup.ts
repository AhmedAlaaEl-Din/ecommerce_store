import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

/** Creates a fresh, separate SQLite database for integration tests (never touches dev.db). */
export default function setup() {
  const root = process.cwd();
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(join(root, "prisma", `test.db${suffix}`), { force: true });
  }
  execSync("npx prisma migrate deploy", {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  });
}
