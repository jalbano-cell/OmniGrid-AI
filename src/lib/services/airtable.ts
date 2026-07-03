import Airtable from "airtable";
import type { Prisma, Business, Audit, Outreach, Meeting } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logEvent, logError } from "@/lib/services/logger";

/**
 * Airtable is kept as a synced CRM mirror — Postgres remains the database
 * the app actually runs on. Every workflow keeps working unchanged if
 * Airtable is unconfigured or unreachable; this module never throws out
 * of its public functions, and every write is retried once before being
 * queued (AirtableSyncQueue) instead of silently dropped.
 *
 * ALL Airtable reads/writes in the codebase must go through this file.
 */

// ---------------------------------------------------------------------------
// Config + base client
// ---------------------------------------------------------------------------

export function isAirtableConfigured(): boolean {
  return Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
}

let cachedBase: Airtable.Base | null = null;

function getBase(): Airtable.Base | null {
  if (!isAirtableConfigured()) return null;
  if (!cachedBase) {
    cachedBase = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
  }
  return cachedBase;
}

const TABLES = {
  leads: "Leads",
  audits: "Audits",
  outreach: "Outreach",
  meetings: "Meetings",
} as const;

type TableName = (typeof TABLES)[keyof typeof TABLES];

// ---------------------------------------------------------------------------
// Field shapes (must match the Airtable base's field names exactly)
// ---------------------------------------------------------------------------

export type AirtableLeadStatus = "New" | "Audited" | "Contacted" | "Replied" | "Interested" | "Closed";
export type AirtableOutreachStatus = "Draft" | "Pending Approval" | "Sent" | "Rejected" | "Replied";
export type AirtableMeetingStatus = "Scheduled" | "Completed" | "Cancelled";

export interface AirtableLeadFields extends Airtable.FieldSet {
  businessName: string;
  website?: string;
  email?: string;
  phone?: string;
  industry?: string;
  location?: string;
  score?: number;
  status?: AirtableLeadStatus;
  lastContacted?: string;
  createdAt?: string;
}

export interface AirtableAuditFields extends Airtable.FieldSet {
  leadId: string;
  uiUxScore?: number;
  seoScore?: number;
  performanceScore?: number;
  conversionScore?: number;
  overallScore: number;
  summary?: string;
  opportunities?: string;
  rawAnalysis?: string;
  createdAt?: string;
}

export interface AirtableOutreachFields extends Airtable.FieldSet {
  leadId: string;
  subject?: string;
  body?: string;
  status?: AirtableOutreachStatus;
  sentAt?: string;
  createdAt?: string;
}

export interface AirtableMeetingFields extends Airtable.FieldSet {
  leadId: string;
  title?: string;
  datetime?: string;
  status?: AirtableMeetingStatus;
  calendarEventId?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Retry + queue-on-failure plumbing
// ---------------------------------------------------------------------------

interface WriteContext {
  table: TableName;
  recordKey: string; // the Postgres id of the row this write is for, for traceability
  action: "create" | "update";
  /** Exactly what's needed to replay this write later (fields, plus recordId for updates). */
  queuePayload: Record<string, unknown>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, ctx: WriteContext): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch {
    await sleep(400);
    try {
      return { ok: true, data: await fn() };
    } catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : String(secondError);
      await logError(`Airtable ${ctx.action} on ${ctx.table} failed twice — queued for retry`, secondError, {
        table: ctx.table,
        recordKey: ctx.recordKey,
      });
      await prisma.airtableSyncQueue
        .create({
          data: {
            table: ctx.table,
            recordKey: ctx.recordKey,
            action: ctx.action,
            payload: ctx.queuePayload as Prisma.InputJsonValue,
            lastError: message,
          },
        })
        .catch((queueErr) => logError("Failed to enqueue Airtable retry", queueErr, { table: ctx.table }));
      return { ok: false, error: message };
    }
  }
}

/** Drains up to `limit` queued failed writes, replaying them against Airtable. Safe to call repeatedly (e.g. from a cron or the backfill script). */
export async function retryQueuedAirtableSyncs(limit = 50): Promise<{ attempted: number; succeeded: number }> {
  const base = getBase();
  if (!base) return { attempted: 0, succeeded: 0 };

  const queued = await prisma.airtableSyncQueue.findMany({ orderBy: { createdAt: "asc" }, take: limit });
  let succeeded = 0;

  for (const item of queued) {
    try {
      if (item.action === "create") {
        const fields = item.payload as Record<string, unknown>;
        await base(item.table).create([{ fields }] as { fields: Partial<Airtable.FieldSet> }[]);
      } else {
        const { __recordId, ...fields } = item.payload as Record<string, unknown> & { __recordId?: string };
        if (!__recordId) throw new Error("Queued update is missing its Airtable record id");
        await base(item.table).update(__recordId, fields as Partial<Airtable.FieldSet>);
      }
      await prisma.airtableSyncQueue.delete({ where: { id: item.id } });
      succeeded++;
    } catch (err) {
      await prisma.airtableSyncQueue.update({
        where: { id: item.id },
        data: { attempts: { increment: 1 }, lastError: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  await logEvent({
    type: "AIRTABLE_SYNC",
    message: `Retried ${queued.length} queued Airtable sync(s), ${succeeded} succeeded`,
  });

  return { attempted: queued.length, succeeded };
}

function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Airtable "date" fields (as opposed to "dateTime") reject full ISO timestamps — YYYY-MM-DD only. */
function toAirtableDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function airtableFindLead(params: {
  website?: string | null;
  businessName?: string | null;
}): Promise<{ recordId: string; fields: AirtableLeadFields } | null> {
  const base = getBase();
  if (!base) return null;

  const clauses: string[] = [];
  if (params.website) clauses.push(`{website} = "${escapeFormulaValue(params.website)}"`);
  if (params.businessName) clauses.push(`{businessName} = "${escapeFormulaValue(params.businessName)}"`);
  if (clauses.length === 0) return null;

  try {
    const formula = clauses.length > 1 ? `OR(${clauses.join(",")})` : clauses[0];
    const records = await base(TABLES.leads).select({ filterByFormula: formula, maxRecords: 1 }).firstPage();
    if (records.length === 0) return null;
    return { recordId: records[0].id, fields: records[0].fields as AirtableLeadFields };
  } catch (err) {
    await logError("Airtable find-lead lookup failed", err, params);
    return null;
  }
}

export async function airtableCreateLead(
  fields: AirtableLeadFields,
  ctx: { businessId: string }
): Promise<{ ok: boolean; recordId?: string; error?: string }> {
  const base = getBase();
  if (!base) return { ok: false, error: "not_configured" };

  const result = await withRetry(async () => (await base(TABLES.leads).create([{ fields }]))[0], {
    table: TABLES.leads,
    recordKey: ctx.businessId,
    action: "create",
    queuePayload: fields,
  });

  if (!result.ok) return { ok: false, error: result.error };
  await logEvent({
    type: "AIRTABLE_SYNC",
    message: `Airtable: created Lead "${fields.businessName}"`,
    businessId: ctx.businessId,
    metadata: { recordId: result.data.id },
  });
  return { ok: true, recordId: result.data.id };
}

export async function airtableUpdateLead(
  recordId: string,
  fields: Partial<AirtableLeadFields>,
  ctx: { businessId: string }
): Promise<{ ok: boolean; error?: string }> {
  const base = getBase();
  if (!base) return { ok: false, error: "not_configured" };

  const result = await withRetry(() => base(TABLES.leads).update(recordId, fields), {
    table: TABLES.leads,
    recordKey: ctx.businessId,
    action: "update",
    queuePayload: { __recordId: recordId, ...fields },
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

function mapBusinessStatusToLeadStatus(status: Business["status"]): AirtableLeadStatus {
  switch (status) {
    case "NEW":
    case "DRAFTED":
      return "New";
    case "APPROVED":
    case "SENT":
      return "Contacted";
    case "REPLIED":
      return "Replied";
    case "INTERESTED":
    case "MEETING_SCHEDULED":
      return "Interested";
    case "CLOSED_WON":
    case "CLOSED_LOST":
    case "DO_NOT_CONTACT":
    case "COLD":
      return "Closed";
    default:
      return "New";
  }
}

/** Idempotent upsert: finds-or-creates the Airtable Lead for this business, and persists the linkage back onto the Postgres row. */
export async function syncLeadToAirtable(business: Business): Promise<string | null> {
  if (!isAirtableConfigured()) return null;

  const fields: AirtableLeadFields = {
    businessName: business.name,
    website: business.website ?? undefined,
    email: business.email ?? undefined,
    phone: business.phone ?? undefined,
    industry: business.industry,
    location: [business.city, business.province].filter(Boolean).join(", "),
    score: business.opportunityScore ?? undefined,
    status: mapBusinessStatusToLeadStatus(business.status),
    lastContacted: business.lastContactDate ? toAirtableDate(business.lastContactDate) : undefined,
    createdAt: toAirtableDate(business.createdAt),
  };

  if (business.airtableRecordId) {
    await airtableUpdateLead(business.airtableRecordId, fields, { businessId: business.id });
    return business.airtableRecordId;
  }

  const existing = await airtableFindLead({ website: business.website, businessName: business.name });
  if (existing) {
    await airtableUpdateLead(existing.recordId, fields, { businessId: business.id });
    await prisma.business.update({ where: { id: business.id }, data: { airtableRecordId: existing.recordId } }).catch(() => {});
    return existing.recordId;
  }

  const created = await airtableCreateLead(fields, { businessId: business.id });
  if (created.ok && created.recordId) {
    await prisma.business.update({ where: { id: business.id }, data: { airtableRecordId: created.recordId } }).catch(() => {});
    return created.recordId;
  }
  return null;
}

/** Convenience wrapper for one-off status/field updates (looks the lead up if we don't have its record id cached yet). */
export async function airtableSyncStatus(
  businessId: string,
  status: AirtableLeadStatus,
  extra?: Partial<Omit<AirtableLeadFields, "status">>
): Promise<void> {
  if (!isAirtableConfigured()) return;

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return;

  let recordId = business.airtableRecordId;
  if (!recordId) {
    recordId = await syncLeadToAirtable(business);
    if (!recordId) return;
  }

  const result = await airtableUpdateLead(recordId, { status, ...extra }, { businessId });
  if (result.ok && !business.airtableRecordId) {
    await prisma.business.update({ where: { id: businessId }, data: { airtableRecordId: recordId } }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

export async function airtableCreateAudit(
  fields: AirtableAuditFields,
  ctx: { auditId: string }
): Promise<{ ok: boolean; recordId?: string; error?: string }> {
  const base = getBase();
  if (!base) return { ok: false, error: "not_configured" };

  const result = await withRetry(async () => (await base(TABLES.audits).create([{ fields }]))[0], {
    table: TABLES.audits,
    recordKey: ctx.auditId,
    action: "create",
    queuePayload: fields,
  });

  if (!result.ok) return { ok: false, error: result.error };
  await logEvent({ type: "AIRTABLE_SYNC", message: "Airtable: created Audit record", metadata: { recordId: result.data.id, auditId: ctx.auditId } });
  return { ok: true, recordId: result.data.id };
}

/** Persists the audit to Airtable, syncs the parent lead's Airtable status → "Audited" + score, per the required workflow rules. */
export async function syncAuditToAirtable(audit: Audit, business: Business): Promise<void> {
  if (!isAirtableConfigured()) return;

  const leadRecordId = business.airtableRecordId ?? (await syncLeadToAirtable(business));

  const fields: AirtableAuditFields = {
    leadId: leadRecordId ?? business.id,
    uiUxScore: audit.uiuxScore,
    seoScore: audit.seoScore,
    performanceScore: audit.performanceScore,
    conversionScore: audit.ctaScore,
    overallScore: audit.overallScore,
    summary: (audit.strengths as string[]).join("\n"),
    opportunities: (audit.recommendations as string[]).join("\n"),
    rawAnalysis: JSON.stringify(
      {
        mobileScore: audit.mobileScore,
        navigationScore: audit.navigationScore,
        accessibilityScore: audit.accessibilityScore,
        trustScore: audit.trustScore,
        brandScore: audit.brandScore,
        weaknesses: audit.weaknesses,
        brokenLinks: audit.brokenLinks,
        scoreBreakdown: audit.scoreBreakdown,
      },
      null,
      2
    ),
    createdAt: toAirtableDate(audit.createdAt),
  };

  const created = await airtableCreateAudit(fields, { auditId: audit.id });
  if (created.ok && created.recordId) {
    await prisma.audit.update({ where: { id: audit.id }, data: { airtableRecordId: created.recordId } }).catch(() => {});
  }

  await airtableSyncStatus(business.id, "Audited", { score: audit.opportunityScore });
}

// ---------------------------------------------------------------------------
// Outreach
// ---------------------------------------------------------------------------

export async function airtableCreateOutreach(
  fields: AirtableOutreachFields,
  ctx: { outreachId: string }
): Promise<{ ok: boolean; recordId?: string; error?: string }> {
  const base = getBase();
  if (!base) return { ok: false, error: "not_configured" };

  const result = await withRetry(async () => (await base(TABLES.outreach).create([{ fields }]))[0], {
    table: TABLES.outreach,
    recordKey: ctx.outreachId,
    action: "create",
    queuePayload: fields,
  });

  if (!result.ok) return { ok: false, error: result.error };
  await logEvent({ type: "AIRTABLE_SYNC", message: "Airtable: created Outreach record", metadata: { recordId: result.data.id, outreachId: ctx.outreachId } });
  return { ok: true, recordId: result.data.id };
}

export async function airtableUpdateOutreach(
  recordId: string,
  fields: Partial<AirtableOutreachFields>,
  ctx: { outreachId: string }
): Promise<{ ok: boolean; error?: string }> {
  const base = getBase();
  if (!base) return { ok: false, error: "not_configured" };

  const result = await withRetry(() => base(TABLES.outreach).update(recordId, fields), {
    table: TABLES.outreach,
    recordKey: ctx.outreachId,
    action: "update",
    queuePayload: { __recordId: recordId, ...fields },
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Called right after a draft is generated: Outreach created in Airtable with status "Pending Approval" (per spec — not "Draft"). */
export async function syncOutreachCreatedToAirtable(outreach: Outreach, business: Business): Promise<void> {
  if (!isAirtableConfigured()) return;

  const leadRecordId = business.airtableRecordId ?? (await syncLeadToAirtable(business));

  const fields: AirtableOutreachFields = {
    leadId: leadRecordId ?? business.id,
    subject: outreach.subject,
    body: outreach.body,
    status: "Pending Approval",
    createdAt: toAirtableDate(outreach.createdAt),
  };

  const created = await airtableCreateOutreach(fields, { outreachId: outreach.id });
  if (created.ok && created.recordId) {
    await prisma.outreach.update({ where: { id: outreach.id }, data: { airtableRecordId: created.recordId } }).catch(() => {});
  }
}

/** Called on send/reject/reply — updates the Outreach record's status (and sentAt when sending), plus the parent Lead's status. */
export async function syncOutreachStatusToAirtable(
  outreach: Outreach & { business: Business },
  status: AirtableOutreachStatus
): Promise<void> {
  if (!isAirtableConfigured()) return;

  let recordId = outreach.airtableRecordId;
  if (!recordId) {
    // Draft was created before Airtable was configured, or the create sync
    // failed earlier — create it now so the status change isn't lost.
    await syncOutreachCreatedToAirtable(outreach, outreach.business);
    const refreshed = await prisma.outreach.findUnique({ where: { id: outreach.id } });
    recordId = refreshed?.airtableRecordId ?? null;
    if (!recordId) return;
  }

  const extra: Partial<AirtableOutreachFields> = status === "Sent" ? { sentAt: toAirtableDate(new Date()) } : {};
  await airtableUpdateOutreach(recordId, { status, ...extra }, { outreachId: outreach.id });

  if (status === "Sent") {
    await airtableSyncStatus(outreach.businessId, "Contacted", { lastContacted: toAirtableDate(new Date()) });
  } else if (status === "Replied") {
    await airtableSyncStatus(outreach.businessId, "Replied");
  }
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export async function airtableCreateMeeting(
  fields: AirtableMeetingFields,
  ctx: { meetingId: string }
): Promise<{ ok: boolean; recordId?: string; error?: string }> {
  const base = getBase();
  if (!base) return { ok: false, error: "not_configured" };

  const result = await withRetry(async () => (await base(TABLES.meetings).create([{ fields }]))[0], {
    table: TABLES.meetings,
    recordKey: ctx.meetingId,
    action: "create",
    queuePayload: fields,
  });

  if (!result.ok) return { ok: false, error: result.error };
  await logEvent({ type: "AIRTABLE_SYNC", message: "Airtable: created Meeting record", metadata: { recordId: result.data.id, meetingId: ctx.meetingId } });
  return { ok: true, recordId: result.data.id };
}

export async function airtableUpdateMeeting(
  recordId: string,
  fields: Partial<AirtableMeetingFields>,
  ctx: { meetingId: string }
): Promise<{ ok: boolean; error?: string }> {
  const base = getBase();
  if (!base) return { ok: false, error: "not_configured" };

  const result = await withRetry(() => base(TABLES.meetings).update(recordId, fields), {
    table: TABLES.meetings,
    recordKey: ctx.meetingId,
    action: "update",
    queuePayload: { __recordId: recordId, ...fields },
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function syncMeetingToAirtable(meeting: Meeting, business: Business): Promise<void> {
  if (!isAirtableConfigured()) return;

  const leadRecordId = business.airtableRecordId ?? (await syncLeadToAirtable(business));

  const fields: AirtableMeetingFields = {
    leadId: leadRecordId ?? business.id,
    title: meeting.title,
    datetime: meeting.datetime.toISOString(),
    status: "Scheduled",
    calendarEventId: meeting.calendarEventId ?? undefined,
    createdAt: toAirtableDate(meeting.createdAt),
  };

  const created = await airtableCreateMeeting(fields, { meetingId: meeting.id });
  if (created.ok && created.recordId) {
    await prisma.meeting.update({ where: { id: meeting.id }, data: { airtableRecordId: created.recordId } }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Read helpers for the "Airtable CRM" UI view (reads straight from Airtable,
// since that's the point of it being a synced mirror the team can trust).
// ---------------------------------------------------------------------------

export async function airtableListLeads(filterByFormula?: string): Promise<Array<{ recordId: string; fields: AirtableLeadFields }>> {
  const base = getBase();
  if (!base) return [];
  try {
    const records = await base(TABLES.leads)
      .select({ maxRecords: 200, sort: [{ field: "createdAt", direction: "desc" }], ...(filterByFormula ? { filterByFormula } : {}) })
      .all();
    return records.map((r) => ({ recordId: r.id, fields: r.fields as AirtableLeadFields }));
  } catch (err) {
    await logError("Airtable list-leads failed", err, { filterByFormula });
    return [];
  }
}

export async function airtableListOutreach(filterByFormula?: string): Promise<Array<{ recordId: string; fields: AirtableOutreachFields }>> {
  const base = getBase();
  if (!base) return [];
  try {
    const records = await base(TABLES.outreach)
      .select({ maxRecords: 200, sort: [{ field: "createdAt", direction: "desc" }], ...(filterByFormula ? { filterByFormula } : {}) })
      .all();
    return records.map((r) => ({ recordId: r.id, fields: r.fields as AirtableOutreachFields }));
  } catch (err) {
    await logError("Airtable list-outreach failed", err, { filterByFormula });
    return [];
  }
}
