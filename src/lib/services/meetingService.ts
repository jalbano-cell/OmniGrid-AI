import { prisma } from "@/lib/db/prisma";
import { calCreateTool } from "@/lib/tools/calCreate";
import { logEvent, logError } from "@/lib/services/logger";

export interface ScheduleMeetingInput {
  businessId: string;
  attendees: string[];
  datetime: string; // ISO 8601
  title?: string;
  durationMinutes?: number;
}

export interface ScheduleMeetingResult {
  ok: boolean;
  meetingId?: string;
  error?: string;
}

/**
 * Only called when the user manually indicates a lead wants a meeting.
 * Books a 30-minute discovery call via cal_create and records it in the CRM.
 */
export async function scheduleDiscoveryCall(input: ScheduleMeetingInput): Promise<ScheduleMeetingResult> {
  const business = await prisma.business.findUnique({ where: { id: input.businessId } });
  if (!business) return { ok: false, error: "Business not found" };

  const title = input.title ?? `Discovery Call: ${business.name}`;
  const durationMinutes = input.durationMinutes ?? 30;

  const result = await calCreateTool.execute({
    title,
    attendees: input.attendees,
    datetime: input.datetime,
    durationMinutes,
    description: `Discovery call with ${business.name} (${business.industry}, ${business.city}), booked via OmniGrid AI.`,
  });

  if (!result.ok || !result.data) {
    await logError(`Failed to book discovery call for ${business.name}`, new Error(result.error ?? "cal_create failed"), {
      businessId: input.businessId,
    });
    return { ok: false, error: result.error ?? "cal_create failed" };
  }

  const meeting = await prisma.meeting.create({
    data: {
      businessId: input.businessId,
      title,
      attendees: input.attendees,
      datetime: new Date(input.datetime),
      durationMinutes,
      calendarEventId: result.data.eventId,
      calendarLink: result.data.htmlLink,
    },
  });

  await prisma.$transaction([
    prisma.business.update({ where: { id: input.businessId }, data: { status: "MEETING_SCHEDULED" } }),
    prisma.statusEvent.create({ data: { businessId: input.businessId, status: "MEETING_SCHEDULED" } }),
  ]);

  await logEvent({
    type: "CALENDAR_EVENT",
    message: `Booked discovery call with ${business.name}`,
    businessId: input.businessId,
    metadata: { meetingId: meeting.id, datetime: input.datetime },
  });

  return { ok: true, meetingId: meeting.id };
}
