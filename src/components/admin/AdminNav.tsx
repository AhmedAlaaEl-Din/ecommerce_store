"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  BoxesIcon,
  FolderIcon,
  GridIcon,
  HistoryIcon,
  ReceiptIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from "../icons";
import { isActive, type AdminNavItem } from "./nav-items";

const ICONS = {
  grid: GridIcon,
  receipt: ReceiptIcon,
  tag: TagIcon,
  folder: FolderIcon,
  boxes: BoxesIcon,
  user: UserIcon,
  users: UsersIcon,
  history: HistoryIcon,
};

export function AdminNav({
  items,
  onNavigate,
  label = "Admin",
}: {
  items: AdminNavItem[];
  onNavigate?: () => void;
  label?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 lg:min-h-10",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-ink/80 hover:bg-sunken hover:text-ink",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
