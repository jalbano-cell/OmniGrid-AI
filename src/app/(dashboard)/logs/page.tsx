import { prisma } from "@/lib/db/prisma";
import { LogsFilter } from "@/components/logs/logs-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { format } from "date-fns";
import type { LogType } from "@prisma/client";

const TYPE_COLOR: Record<string, string> = {
  ERROR: "bg-destructive/15 text-destructive border-transparent",
  TOOL_CALL: "bg-primary/15 text-primary border-transparent",
  SEARCH: "bg-[oklch(0.62_0.14_165_/_0.15)] text-[oklch(0.75_0.15_165)] border-transparent",
  AUDIT: "bg-[oklch(0.66_0.15_75_/_0.15)] text-[oklch(0.78_0.15_75)] border-transparent",
  EMAIL_GENERATED: "bg-[oklch(0.68_0.19_300_/_0.15)] text-[oklch(0.8_0.14_300)] border-transparent",
  APPROVAL_ACTION: "bg-muted text-foreground border-transparent",
  CALENDAR_EVENT: "bg-[oklch(0.62_0.19_50_/_0.15)] text-[oklch(0.75_0.17_50)] border-transparent",
};

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const logs = await prisma.logEntry.findMany({
    where: type ? { type: type as LogType } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Logs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Full audit trail of tool calls, searches, audits, emails, and errors.</p>
        </div>
        <LogsFilter />
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No logs yet" description="Activity across the platform will appear here." />
      ) : (
        <div className="rounded-lg border border-border/60 divide-y divide-border/60">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3">
              <Badge variant="outline" className={`shrink-0 font-normal ${TYPE_COLOR[log.type] ?? ""}`}>
                {log.type.replaceAll("_", " ")}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{log.message}</p>
                {Boolean(log.metadata) && Object.keys(log.metadata as object).length > 0 && (
                  <pre className="mt-1 text-[11px] text-muted-foreground overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 0)}
                  </pre>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {format(log.createdAt, "MMM d, h:mm:ss a")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
