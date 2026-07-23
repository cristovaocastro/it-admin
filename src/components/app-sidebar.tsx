"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Network,
  UserCog,
  UsersRound,
  ShieldCheck,
  Monitor,
  FolderTree,
  Flame,
  ListFilter,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

type NavGroup = { title?: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "OPERATOR", "AUDITOR"] },
    ],
  },
  {
    title: "Administração",
    items: [
      { href: "/usuarios", label: "Usuários do painel", icon: Users, roles: ["ADMIN"] },
      { href: "/auditoria", label: "Auditoria", icon: ScrollText, roles: ["ADMIN", "AUDITOR"] },
    ],
  },
  {
    title: "Active Directory",
    items: [
      { href: "/ad/conexoes", label: "Conexões", icon: Network, roles: ["ADMIN"] },
      { href: "/ad/arvore", label: "Árvore do diretório", icon: FolderTree, roles: ["ADMIN", "OPERATOR"] },
      { href: "/ad/usuarios", label: "Usuários AD", icon: UserCog, roles: ["ADMIN", "OPERATOR"] },
      { href: "/ad/grupos", label: "Grupos AD", icon: UsersRound, roles: ["ADMIN", "OPERATOR"] },
      { href: "/ad/computadores", label: "Computadores", icon: Monitor, roles: ["ADMIN", "OPERATOR"] },
    ],
  },
  {
    title: "Firewall",
    items: [
      { href: "/firewall/conexoes", label: "Conexões", icon: Flame, roles: ["ADMIN"] },
      { href: "/firewall/uri-lists", label: "URI Lists", icon: ListFilter, roles: ["ADMIN"] },
    ],
  },
];

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-4" />
        </div>
        <span className="font-semibold">IT Admin</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {NAV.map((group, i) => {
          const items = group.items.filter((item) => item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={i}>
              {group.title && (
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
