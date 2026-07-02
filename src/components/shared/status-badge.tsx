import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BusinessStatus, OutreachStatus } from "@prisma/client";

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-muted text-muted-foreground border-transparent",
  DRAFTED: "bg-[oklch(0.62_0.14_75_/_0.15)] text-[oklch(0.75_0.14_75)] border-transparent",
  APPROVED: "bg-primary/15 text-primary border-transparent",
  SENT: "bg-primary/15 text-primary border-transparent",
  REPLIED: "bg-[oklch(0.62_0.14_165_/_0.15)] text-[oklch(0.72_0.14_165)] border-transparent",
  INTERESTED: "bg-[oklch(0.62_0.14_165_/_0.2)] text-[oklch(0.75_0.16_165)] border-transparent",
  MEETING_SCHEDULED: "bg-[oklch(0.68_0.19_300_/_0.18)] text-[oklch(0.8_0.14_300)] border-transparent",
  CLOSED_WON: "bg-[oklch(0.62_0.14_165_/_0.25)] text-[oklch(0.8_0.16_165)] border-transparent",
  CLOSED: "bg-[oklch(0.62_0.14_165_/_0.25)] text-[oklch(0.8_0.16_165)] border-transparent",
  CLOSED_LOST: "bg-destructive/15 text-destructive border-transparent",
  DO_NOT_CONTACT: "bg-destructive/15 text-destructive border-transparent",
  REJECTED: "bg-destructive/15 text-destructive border-transparent",
};

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  DRAFTED: "Drafted",
  APPROVED: "Approved",
  SENT: "Sent",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  MEETING_SCHEDULED: "Meeting Scheduled",
  CLOSED_WON: "Closed Won",
  CLOSED: "Closed",
  CLOSED_LOST: "Closed Lost",
  DO_NOT_CONTACT: "Do Not Contact",
  REJECTED: "Rejected",
};

export function StatusBadge({ status, className }: { status: BusinessStatus | OutreachStatus | string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_STYLE[status] ?? "", className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
