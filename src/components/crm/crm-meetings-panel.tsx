import { EmptyState } from "@/components/shared/empty-state";
import { CalendarDays, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { Meeting } from "@prisma/client";

export function CrmMeetingsPanel({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return <EmptyState icon={CalendarDays} title="No meetings booked" description="Schedule a discovery call from the Calendar page once this lead is ready." />;
  }

  return (
    <div className="space-y-2">
      {meetings.map((m) => (
        <div key={m.id} className="rounded-lg border border-border/60 p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{m.title}</p>
            <p className="text-xs text-muted-foreground">{(m.attendees as string[]).join(", ")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm tabular-nums">{format(m.datetime, "MMM d, yyyy h:mm a")}</p>
            {m.calendarLink && (
              <a href={m.calendarLink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                View <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
