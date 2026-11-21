import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyRow,
  PageHeader,
  ResultCount,
  smallField,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDateTime, hrefWith, oneOf, pageParam, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { AUDIT_ENTITIES, AUDIT_PAGE_SIZE, listAudit, summaryText } from "@/lib/admin/audit-list";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function entityHref(type: string, id: string | null): string | null {
  if (!id) return null;
  if (type === "Order") return `/admin/orders/${id}`;
  if (type === "Product") return `/admin/products/${id}`;
  if (type === "Category") return `/admin/categories/${id}`;
  return null;
}

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const from = param(sp, "from");
  const to = param(sp, "to");
  const params = {
    user: param(sp, "user"),
    entity: oneOf(param(sp, "entity"), AUDIT_ENTITIES),
    q: param(sp, "q"),
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    page: param(sp, "page"),
  };
  const [users, list] = await Promise.all([
    db.adminUser.findMany({ orderBy: { email: "asc" }, select: { id: true, name: true, email: true } }),
    listAudit(db, { actorId: params.user, entity: params.entity, q: params.q, from: params.from, to: params.to, page: pageParam(params.page) }),
  ]);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every admin change and every sign-in attempt. Summaries never contain customer details or passwords; emails are masked."
      />
      <form method="get" className="mb-3 flex flex-wrap items-end gap-2" role="search" aria-label="Filter the audit log">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          User
          <select name="user" defaultValue={params.user ?? ""} className={smallField}>
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Entity
          <select name="entity" defaultValue={params.entity ?? ""} className={smallField}>
            <option value="">All</option>
            {AUDIT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e === "AdminUser" ? "User / sign-in" : e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Action or id
          <input type="search" name="q" defaultValue={params.q} placeholder="e.g. refund, login_failed" className={`${smallField} w-52`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          From
          <input type="date" name="from" defaultValue={params.from} className={smallField} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          To
          <input type="date" name="to" defaultValue={params.to} className={smallField} />
        </label>
        <button type="submit" className="bg-ink hover:bg-ink/85 h-10 rounded-sm px-4 text-sm font-medium text-white">
          Apply
        </button>
        <Link href="/admin/audit" className="text-primary inline-flex h-10 items-center px-2 text-sm underline underline-offset-2">
          Reset
        </Link>
      </form>
      <div className="mb-2">
        <ResultCount page={list.page} pageSize={AUDIT_PAGE_SIZE} total={list.total} noun="entries" />
      </div>
      <TableWrap label="Audit log">
        <thead>
          <tr>
            <th scope="col" className={thClass}>When</th>
            <th scope="col" className={thClass}>Who</th>
            <th scope="col" className={thClass}>Action</th>
            <th scope="col" className={thClass}>Entity</th>
            <th scope="col" className={thClass}>Details</th>
          </tr>
        </thead>
        <tbody>
          {list.rows.length === 0 && <EmptyRow colSpan={5} title="No entries match these filters" />}
          {list.rows.map((r) => {
            const href = entityHref(r.entityType, r.entityId);
            return (
              <tr key={r.id} className="hover:bg-sunken/40" data-testid="audit-row">
                <td className={`${tdClass} text-muted whitespace-nowrap`}>{fmtDateTime(r.createdAt)}</td>
                <td className={tdClass}>{r.actor?.name ?? <span className="text-muted">Anonymous / system</span>}</td>
                <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>{r.action}</td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {href ? (
                    <Link href={href} className="text-primary underline-offset-2 hover:underline">
                      {r.entityType}
                    </Link>
                  ) : (
                    r.entityType
                  )}
                </td>
                <td className={`${tdClass} text-muted max-w-xl text-xs break-words`}>{summaryText(r.summary)}</td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      <div className="mt-4">
        <Pagination page={list.page} totalPages={list.pageCount} hrefFor={(n) => hrefWith("/admin/audit", params, { page: String(n) })} />
      </div>
    </>
  );
}
