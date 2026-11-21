/**
 * Admin roles and what each may do. Pure module: used on the server for checks
 * (through requireAdmin) and in the UI to hide controls a role cannot use.
 * Hiding a button is never the check itself.
 */
export const ADMIN_ROLES = ["admin", "staff"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = {
  "dashboard.view": ["admin", "staff"],
  "orders.view": ["admin", "staff"],
  "orders.fulfil": ["admin", "staff"],
  "orders.note": ["admin", "staff"],
  "orders.packingSlip": ["admin", "staff"],
  "orders.cancel": ["admin"],
  "orders.refund": ["admin"],
  "orders.export": ["admin"],
  "products.view": ["admin", "staff"],
  "products.adjustStock": ["admin", "staff"],
  "products.edit": ["admin"],
  "products.archive": ["admin"],
  "products.delete": ["admin"],
  "inventory.view": ["admin", "staff"],
  "inventory.settings": ["admin"],
  "categories.manage": ["admin"],
  "customers.view": ["admin"],
  "users.manage": ["admin"],
  "audit.view": ["admin"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: AdminRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly AdminRole[]).includes(role);
}

/** The role a permission needs: "admin" if staff may not, otherwise "staff" (any signed-in user). */
export function minimumRole(permission: Permission): AdminRole {
  return can("staff", permission) ? "staff" : "admin";
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<AdminRole, string> = { admin: "Admin", staff: "Staff" };
