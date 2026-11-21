import type { Metadata } from "next";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import {
  DoneNotice,
  Notice,
  PageHeader,
  Panel,
  Pill,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { fmtDateTime, param } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { ROLE_LABELS } from "@/lib/admin/roles";
import { isLocked } from "@/lib/admin/session-rules";
import { listUsers } from "@/lib/admin/users";
import { db } from "@/lib/db";
import { changeRoleAction, setActiveAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users" };

const DONE = { role: "Role changed.", enabled: "Account enabled.", disabled: "Account disabled and signed out everywhere." };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { user: me } = await requireAdmin("admin");
  const sp = await searchParams;
  const done = param(sp, "done");
  const users = await listUsers(db);
  const now = new Date();

  return (
    <>
      <PageHeader title="Users" description="Admins only. You can’t change your own role or disable yourself, and there is always at least one active admin." />
      <DoneNotice code={done} messages={DONE} />
      {(done === "role_refused" || done === "active_refused") && (
        <Notice tone="error">That change was refused: the store must keep at least one active admin, and you can’t demote or disable yourself.</Notice>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <TableWrap label="Users">
          <thead>
            <tr>
              <th scope="col" className={thClass}>User</th>
              <th scope="col" className={thClass}>Role</th>
              <th scope="col" className={thClass}>Status</th>
              <th scope="col" className={thClass}>Last sign-in</th>
              <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id} className="hover:bg-sunken/40" data-testid="user-row">
                  <td className={tdClass}>
                    <span className="font-medium">{u.name}</span>
                    {self && <span className="text-muted ml-1 text-xs">(you)</span>}
                    <div className="text-muted text-xs">{u.email}</div>
                  </td>
                  <td className={tdClass}>
                    {self ? (
                      ROLE_LABELS[u.role]
                    ) : (
                      <form action={changeRoleAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="userId" value={u.id} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.email}</label>
                        <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="border-line-strong bg-surface h-9 rounded-sm border px-2 text-sm">
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button type="submit" className="text-primary min-h-9 px-1 text-sm font-medium underline underline-offset-2">
                          Save
                        </button>
                      </form>
                    )}
                  </td>
                  <td className={tdClass}>
                    {!u.isActive ? (
                      <Pill tone="neutral">Disabled</Pill>
                    ) : isLocked(u.lockedUntil, now) ? (
                      <Pill tone="bad">Locked</Pill>
                    ) : (
                      <Pill tone="good">Active</Pill>
                    )}
                  </td>
                  <td className={`${tdClass} text-muted whitespace-nowrap`}>{fmtDateTime(u.lastLoginAt)}</td>
                  <td className={`${tdClass} text-right`}>
                    {!self &&
                      (u.isActive ? (
                        <ConfirmDialog
                          testId={`disable-${u.email.split("@")[0]}`}
                          triggerLabel="Disable"
                          title={`Disable ${u.email}?`}
                          confirmLabel="Disable account"
                          action={setActiveAction}
                          hidden={{ userId: u.id, active: "0" }}
                        >
                          They are signed out at once and can’t sign in until an admin enables the account again.
                        </ConfirmDialog>
                      ) : (
                        <form action={setActiveAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="active" value="1" />
                          <button type="submit" className="border-line-strong hover:border-ink inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-medium">
                            Enable
                          </button>
                        </form>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
        <Panel title="Invite a user" id="invite">
          <InviteUserForm />
        </Panel>
      </div>
    </>
  );
}
