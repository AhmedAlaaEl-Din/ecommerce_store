import { can, type AdminRole, type Permission } from "@/lib/admin/roles";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: "grid" | "receipt" | "tag" | "folder" | "boxes" | "user" | "users" | "history";
  permission: Permission;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "grid", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", icon: "receipt", permission: "orders.view" },
  { href: "/admin/products", label: "Products", icon: "tag", permission: "products.view" },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: "folder",
    permission: "categories.manage",
  },
  { href: "/admin/inventory", label: "Inventory", icon: "boxes", permission: "inventory.view" },
  { href: "/admin/customers", label: "Customers", icon: "user", permission: "customers.view" },
  { href: "/admin/users", label: "Users", icon: "users", permission: "users.manage" },
  { href: "/admin/audit", label: "Audit log", icon: "history", permission: "audit.view" },
];

export function navFor(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV.filter((i) => can(role, i.permission));
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}
