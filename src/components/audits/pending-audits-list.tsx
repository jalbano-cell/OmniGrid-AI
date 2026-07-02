"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runAuditAction } from "@/app/actions/audits";
import { Loader2, ScanSearch } from "lucide-react";
import type { Business } from "@prisma/client";

export function PendingAuditsList({ businesses }: { businesses: Pick<Business, "id" | "name" | "website" | "city" | "industry">[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (businesses.length === 0) return null;

  function run(id: string, name: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await runAuditAction(id);
      setPendingId(null);
      if (result.ok) toast.success(`Audited ${name}`);
      else toast.error(result.error ?? "Audit failed");
    });
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Needs Audit ({businesses.length})</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border/60">
        {businesses.map((b) => (
          <div key={b.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{b.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {b.industry} · {b.city}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => run(b.id, b.name)} disabled={pendingId === b.id}>
              {pendingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
              Run audit
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
