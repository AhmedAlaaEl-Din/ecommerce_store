import { can, type AdminRole, type Permission } from "./roles";

/** Who is making a change. Comes from requireAdmin() on the server, never from the client. */
export type Actor = { id: string; role: AdminRole };

export class AdminPermissionError extends Error {
  constructor(readonly permission: Permission) {
    super(`Not allowed: ${permission}`);
    this.name = "AdminPermissionError";
  }
}

/** Second line of defence inside every admin service function. */
export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) throw new AdminPermissionError(permission);
}

/** Result type shared by admin services. */
export type ServiceResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fieldErrors?: Record<string, string>) {
  return { ok: false as const, error, fieldErrors };
}
