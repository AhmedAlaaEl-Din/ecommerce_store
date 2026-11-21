/**
 * Audit log writer. Summaries never contain personal data: no customer emails,
 * names or addresses, no passwords. Only ids, statuses, numbers and admin-entered
 * catalog text (product names, prices) are recorded.
 */
import type { Db } from "../db";

export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
type Writer = Pick<Tx, "auditLog">;

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: Record<string, unknown>;
  now?: Date;
};

const MAX_SUMMARY = 2_000;

export async function writeAudit(tx: Writer, e: AuditEntry): Promise<void> {
  let summary = JSON.stringify(e.summary ?? {});
  if (summary.length > MAX_SUMMARY) summary = JSON.stringify({ truncated: true });
  await tx.auditLog.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      summary,
      ...(e.now ? { createdAt: e.now } : {}),
    },
  });
}

/**
 * Before/after summary of the listed fields that changed:
 * { priceCents: [2400, 2600], isActive: [true, false] }
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T & string)[],
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    const a = norm(before[f]);
    const b = norm(after[f]);
    if (a !== b) out[f] = [clip(a), clip(b)];
  }
  return out;
}

function norm(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v === undefined ? null : v;
}

function clip(v: unknown): unknown {
  return typeof v === "string" && v.length > 80 ? `${v.slice(0, 77)}...` : v;
}
