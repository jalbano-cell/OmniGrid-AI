"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "./nav-items";
import { Building2 } from "lucide-react";
import { useCommandPalette } from "./command-palette-context";

interface SearchResult {
  id: string;
  name: string;
  city: string;
  industry: string;
  status: string;
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        // aborted or network error — ignore, next keystroke retries
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router, setOpen]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette" description="Jump to a page or business">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search pages, leads, cities, industries…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {results.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Businesses">
                {results.map((r) => (
                  <CommandItem key={r.id} onSelect={() => go(`/crm/${r.id}`)}>
                    <Building2 className="h-4 w-4" />
                    <span>{r.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.industry} · {r.city}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
