"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { Sparkles, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { MockupQueuePanel } from "@/components/mockups/mockup-queue-panel";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 h-14 border-b border-sidebar-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">OmniGrid AI</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        <nav className="px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <MockupQueuePanel />
      </div>

      <div className="px-4 py-3 border-t border-sidebar-border flex items-center justify-between">
        <span className="text-[13px] text-sidebar-foreground/40">Internal tool · v0.1</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1 text-[13px] text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
