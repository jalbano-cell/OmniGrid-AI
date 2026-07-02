import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScheduleMeetingDialog } from "@/components/calendar/schedule-meeting-dialog";
import { getGoogleAuthStatus } from "@/lib/google/tokenStore";
import { CalendarDays, ExternalLink, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default async function CalendarPage() {
  const [meetings, businesses, googleAuth] = await Promise.all([
    prisma.meeting.findMany({ include: { business: true }, orderBy: { datetime: "asc" } }),
    prisma.business.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    getGoogleAuthStatus(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Calendar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Discovery calls booked via Google Calendar.</p>
        </div>
        <ScheduleMeetingDialog businesses={businesses} />
      </div>

      {!googleAuth.connected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Google Calendar isn&apos;t connected</AlertTitle>
          <AlertDescription>Connect your Google account in Settings to book real calendar events.</AlertDescription>
        </Alert>
      )}

      {meetings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No meetings booked yet"
          description="Once a lead indicates they want to talk, schedule a 30-minute discovery call here or from their profile."
        />
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <Card key={m.id} className="border-border/60">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  <Link href={`/crm/${m.businessId}`} className="text-xs text-muted-foreground hover:underline">
                    {m.business.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(m.attendees as string[]).join(", ") || "No attendees listed"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{format(m.datetime, "MMM d, yyyy h:mm a")}</p>
                  <p className="text-xs text-muted-foreground">{m.durationMinutes} min</p>
                  {m.calendarLink && (
                    <a
                      href={m.calendarLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      View in Calendar <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
