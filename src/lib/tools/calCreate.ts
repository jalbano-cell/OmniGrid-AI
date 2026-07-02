import { google } from "googleapis";
import { getAuthenticatedGoogleClient } from "@/lib/google/tokenStore";
import { logEvent, logError } from "@/lib/services/logger";
import type { ToolDefinition, ToolResult } from "./types";

export interface CalCreateInput {
  title: string;
  attendees: string[];
  /** ISO 8601 datetime string, e.g. "2026-07-10T15:00:00-04:00" */
  datetime: string;
  durationMinutes?: number;
  description?: string;
}

export interface CalCreateOutput {
  eventId: string;
  htmlLink: string;
}

/**
 * cal_create(title, attendees, datetime) — books a meeting on the connected
 * Google Calendar. Only invoked when the user manually marks a lead as
 * wanting a meeting (never automatically).
 */
async function execute({
  title,
  attendees,
  datetime,
  durationMinutes = 30,
  description,
}: CalCreateInput): Promise<ToolResult<CalCreateOutput>> {
  try {
    const auth = await getAuthenticatedGoogleClient();
    const calendar = google.calendar({ version: "v3", auth });

    const start = new Date(datetime);
    if (Number.isNaN(start.getTime())) {
      throw new Error(`Invalid datetime: ${datetime}`);
    }
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const res = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      requestBody: {
        summary: title,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `omnigrid-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
      conferenceDataVersion: 1,
    });

    await logEvent({
      type: "CALENDAR_EVENT",
      message: `cal_create → "${title}" with ${attendees.join(", ")}`,
      metadata: { title, attendees, datetime, eventId: res.data.id },
    });

    return {
      ok: true,
      data: { eventId: res.data.id ?? "", htmlLink: res.data.htmlLink ?? "" },
    };
  } catch (err) {
    await logError(`cal_create "${title}" failed`, err, { title, attendees, datetime });
    return { ok: false, error: err instanceof Error ? err.message : "cal_create failed" };
  }
}

export const calCreateTool: ToolDefinition<CalCreateInput, CalCreateOutput> = {
  name: "cal_create",
  description: "Create a calendar event with attendees on the connected Google Calendar.",
  execute,
};
