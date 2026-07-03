"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Mail, Eye } from "lucide-react";
import { format } from "date-fns";
import type { Outreach } from "@prisma/client";

export function CrmOutreachPanel({ outreach }: { outreach: Outreach[] }) {
  const [preview, setPreview] = useState<Outreach | null>(null);

  if (outreach.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No outreach yet"
        description="Generate a draft from the header above."
      />
    );
  }

  return (
    <div className="space-y-2">
      {outreach.map((o) => (
        <div key={o.id} className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{o.subject}</p>
              <StatusBadge status={o.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(o.updatedAt, "MMM d, yyyy h:mm a")} · confidence {o.confidenceScore}%
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(o)}>
              <Eye className="h-4 w-4" />
            </Button>
            {o.status === "DRAFTED" && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/outreach">Review</Link>
              </Button>
            )}
          </div>
        </div>
      ))}

      <Dialog open={Boolean(preview)} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.subject}</DialogTitle>
            <DialogDescription>To: {preview?.toEmail ?? "—"}</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-4 max-h-96 overflow-y-auto">
            {preview?.body}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
