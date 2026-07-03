"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "./command-palette-context";
import { NAV_ITEMS } from "./nav-items";

export function TopBar() {
  const { setOpen } = useCommandPalette();
  const pathname = usePathname();
  const title =
    NAV_ITEMS.slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))?.label ??
    (pathname.startsWith("/crm/") ? "Business Profile" : "OmniGrid AI");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border/60 bg-background/80 backdrop-blur px-4 md:px-6">
      <h1 className="text-sm font-medium text-foreground/90">{title}</h1>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 text-muted-foreground font-normal w-56 justify-start hidden sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Search…</span>
        <kbd className="ml-auto text-[12px] bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 sm:hidden" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>
    </header>
  );
}
