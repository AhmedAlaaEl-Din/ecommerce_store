import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "../db";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_ENTITIES = ["AdminUser", "Product", "Category", "Order", "Setting"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AuditFilters = {
  actorId?: string;
  entity?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
};

export async function listAudit(db: Db, f: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.actorId) where.actorId = f.actorId;
  if (f.entity) where.entityType = f.entity;
  const q = f.q?.trim().slice(0, 80);
  if (q) where.OR = [{ action: { contains: q } }, { entityId: { contains: q } }];
  const created: Prisma.DateTimeFilter = {};
  if (f.from && DATE_RE.test(f.from)) created.gte = new Date(`${f.from}T00:00:00Z`);
  if (f.to && DATE_RE.test(f.to)) created.lt = new Date(new Date(`${f.to}T00:00:00Z`).getTime() + 86_400_000);
  if (created.gte || created.lt) where.createdAt = created;
  const page = Math.max(1, f.page ?? 1);
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);
  return { total, rows, page, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

/** Compact one-line rendering of a summary JSON (shown as text, never HTML). */
export function summaryText(json: string): string {
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const parts = Object.entries(v)
      .filter(([, val]) => val !== undefined && val !== null)
      .map(([k, val]) => {
        if (k === "changes" && val && typeof val === "object") {
          const ch = Object.entries(val as Record<string, [unknown, unknown]>)
            .map(([f, [a, b]]) => `${f}: ${String(a)} → ${String(b)}`)
            .join("; ");
          return ch ? `changed ${ch}` : "no changes";
        }
        if (Array.isArray(val) && val.length === 2) return `${k}: ${String(val[0])} → ${String(val[1])}`;
        if (typeof val === "object") return `${k}: ${JSON.stringify(val)}`;
        return `${k}: ${String(val)}`;
      });
    return parts.join(" · ");
  } catch {
    return "";
  }
}
