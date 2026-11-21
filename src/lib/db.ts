import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

/** Creates a Prisma client for the given SQLite URL (defaults to DATABASE_URL). */
export function createDb(url = process.env.DATABASE_URL ?? "file:./prisma/dev.db"): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForDb = globalThis as unknown as { __nileDb?: PrismaClient };

/** Shared client; reused across hot reloads in development. */
export const db: PrismaClient = globalForDb.__nileDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.__nileDb = db;
