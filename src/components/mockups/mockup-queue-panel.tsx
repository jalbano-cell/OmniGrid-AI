"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, LayoutTemplate } from "lucide-react";
import { useMockupQueue } from "./mockup-queue-context";
import { MockupQueueCard } from "./mockup-queue-card";

export function MockupQueuePanel() {
  const { items } = useMockupQueue();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="border-t border-sidebar-border">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <LayoutTemplate className="h-3.5 w-3.5" />
          Mockup Queue
          {items.length > 0 && (
            <span className="rounded-full bg-primary/15 text-primary px-1.5 py-px text-[10px] leading-tight font-normal">
              {items.length}
            </span>
          )}
        </span>
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-1.5 max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-[11px] text-sidebar-foreground/40 px-0.5">
              No mockups queued yet. Use &quot;Send to mockup&quot; on a lead to add one.
            </p>
          ) : (
            items.map((item) => (
              <MockupQueueCard
                key={item.id}
                item={item}
                expanded={expandedIds.has(item.id)}
                onToggleExpand={() => toggleExpanded(item.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
