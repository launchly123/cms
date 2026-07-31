"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const nav = [
  { label: "Websites", href: "/", icon: "◈" },
  { label: "Leads", href: "/leads", icon: "◎" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/owner/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-sm font-bold text-[var(--accent-foreground)]">
          ▲
        </div>
        <span className="font-semibold tracking-tight">Agency Console</span>
      </div>

      <nav className="flex-1 px-3 py-4">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted">
          Manage
        </p>
        {nav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-card-hover text-foreground"
                  : "text-muted hover:bg-card-hover hover:text-foreground"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-card-hover hover:text-foreground"
        >
          <span className="text-base">⏻</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
