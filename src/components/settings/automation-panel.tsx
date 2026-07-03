"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { runDailyPipelineAction } from "@/app/actions/automation";
import { Loader2, PlayCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DailyRunSummary } from "@/lib/services/dailyRun";

interface AutomationPanelProps {
  cronConfigured: boolean;
  lastRun: { message: string; createdAt: Date } | null;
}

export function AutomationPanel({ cronConfigured, lastRun }: AutomationPanelProps) {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<DailyRunSummary | null>(null);

  function run() {
    startTransition(async () => {
      const result = await runDailyPipelineAction();
      setSummary(result);
      toast.success(
        `Daily run complete: ${result.leadsFound} leads, ${result.auditsCompleted} audits, ${result.emailsGenerated} emails drafted`
      );
    });
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Daily Autonomous Run</CardTitle>
        <CardDescription>
          Discovers leads, filters low-quality ones, audits and drafts emails for high-scoring leads (≥ 70), and runs
          the 3/7/14-day follow-up cadence. Everything still lands in the approval queue — nothing sends automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Scheduled runs (Vercel Cron)</p>
            <p className="text-xs text-muted-foreground">
              {cronConfigured
                ? "CRON_SECRET is set — /api/cron/daily-run runs daily per vercel.json's schedule."
                : "Set CRON_SECRET in .env / Vercel env vars to secure the scheduled endpoint."}
            </p>
            {lastRun && (
              <p className="text-xs text-muted-foreground mt-1">
                Last run {formatDistanceToNow(lastRun.createdAt, { addSuffix: true })}: {lastRun.message}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={run} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            Run Now
          </Button>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat label="Leads found" value={summary.leadsFound} />
            <Stat label="Filtered out" value={summary.leadsFiltered} />
            <Stat label="Audits" value={summary.auditsCompleted} />
            <Stat label="Emails drafted" value={summary.emailsGenerated} />
            <Stat label="Follow-ups" value={summary.followUpsCreated} />
            <Stat label="Marked cold" value={summary.leadsMarkedCold} />
            <Stat label="Audit errors" value={summary.auditErrors} />
            <Stat label="Email errors" value={summary.emailErrors} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 p-2.5 text-center">
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
