import { prisma } from "@/lib/db/prisma";
import { gmailSendTool } from "@/lib/tools/gmailSend";
import { logEvent, logError } from "@/lib/services/logger";
import { getEmailsApprovedToday, getSettings } from "@/lib/services/settings";
import { syncOutreachStatusToAirtable, airtableSyncStatus } from "@/lib/services/airtable";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Approve → the ONLY path in the app that results in gmail_send being
 * called. Enforces the daily approval limit and the "never email the same
 * business twice" safety rule unless the caller explicitly marks this as an
 * intentional follow-up.
 */
export async function approveAndSendOutreach(outreachId: string, isExplicitFollowUp = false): Promise<ActionResult> {
  const outreach = await prisma.outreach.findUnique({ where: { id: outreachId }, include: { business: true } });
  if (!outreach) return { ok: false, error: "Outreach not found" };
  if (outreach.status !== "DRAFTED") {
    return { ok: false, error: `Cannot approve an email in "${outreach.status}" status` };
  }
  if (!outreach.toEmail) {
    return { ok: false, error: "This business has no known email address — add one before approving" };
  }

  const settings = await getSettings();
  const approvedToday = await getEmailsApprovedToday();
  if (approvedToday >= settings.dailyEmailApprovalLimit) {
    return { ok: false, error: `Daily email approval limit reached (${settings.dailyEmailApprovalLimit}/day)` };
  }

  const alreadySent = await prisma.outreach.findFirst({
    where: { businessId: outreach.businessId, status: { in: ["SENT", "REPLIED", "INTERESTED", "MEETING_SCHEDULED", "CLOSED"] } },
  });
  if (alreadySent && !isExplicitFollowUp) {
    return {
      ok: false,
      error: "This business has already been emailed. Mark this explicitly as a follow-up to send again.",
    };
  }

  const now = new Date();
  await prisma.outreach.update({ where: { id: outreachId }, data: { status: "APPROVED", approvedAt: now } });
  await logEvent({ type: "APPROVAL_ACTION", message: `Approved outreach to ${outreach.toEmail}`, businessId: outreach.businessId, metadata: { outreachId } });

  const sendResult = await gmailSendTool.execute({
    to: outreach.toEmail,
    subject: outreach.subject,
    body: outreach.body,
  });

  if (!sendResult.ok || !sendResult.data) {
    await logError(`Approved email failed to send to ${outreach.toEmail}`, new Error(sendResult.error ?? "send failed"), { outreachId });
    return { ok: false, error: sendResult.error ?? "gmail_send failed" };
  }

  const sentAt = new Date();
  await prisma.$transaction([
    prisma.outreach.update({
      where: { id: outreachId },
      data: {
        status: "SENT",
        sentAt,
        gmailMessageId: sendResult.data.messageId,
        gmailThreadId: sendResult.data.threadId,
      },
    }),
    prisma.business.update({
      where: { id: outreach.businessId },
      data: { status: "SENT", lastContactDate: sentAt },
    }),
    prisma.statusEvent.create({
      data: { businessId: outreach.businessId, status: "SENT", note: `Email sent to ${outreach.toEmail}` },
    }),
  ]);

  // Mirror into Airtable: Outreach.status="Sent", Leads.status="Contacted".
  // Runs immediately after the send succeeds — never blocks/undoes it.
  await syncOutreachStatusToAirtable(outreach, "Sent").catch((err) =>
    logError("Airtable outreach-sent sync failed", err, { outreachId })
  );

  return { ok: true };
}

export async function rejectOutreach(outreachId: string, reason?: string): Promise<ActionResult> {
  const outreach = await prisma.outreach.findUnique({ where: { id: outreachId }, include: { business: true } });
  if (!outreach) return { ok: false, error: "Outreach not found" };

  await prisma.outreach.update({
    where: { id: outreachId },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectReason: reason },
  });
  await logEvent({
    type: "APPROVAL_ACTION",
    message: `Rejected draft outreach${reason ? `: ${reason}` : ""}`,
    businessId: outreach.businessId,
    metadata: { outreachId, reason },
  });

  await syncOutreachStatusToAirtable(outreach, "Rejected").catch((err) =>
    logError("Airtable outreach-rejected sync failed", err, { outreachId })
  );

  return { ok: true };
}

export async function editOutreach(outreachId: string, data: { subject?: string; body?: string; toEmail?: string }): Promise<ActionResult> {
  const outreach = await prisma.outreach.findUnique({ where: { id: outreachId } });
  if (!outreach) return { ok: false, error: "Outreach not found" };
  if (outreach.status !== "DRAFTED") {
    return { ok: false, error: "Only drafted emails can be edited" };
  }

  await prisma.outreach.update({ where: { id: outreachId }, data });
  await logEvent({
    type: "APPROVAL_ACTION",
    message: "Edited draft outreach",
    businessId: outreach.businessId,
    metadata: { outreachId, fields: Object.keys(data) },
  });
  return { ok: true };
}

/** Manually record a reply — there's no inbox integration, so this is a deliberate user action. */
export async function markOutreachReplied(outreachId: string): Promise<ActionResult> {
  const outreach = await prisma.outreach.findUnique({ where: { id: outreachId }, include: { business: true } });
  if (!outreach) return { ok: false, error: "Outreach not found" };

  const now = new Date();
  await prisma.$transaction([
    prisma.outreach.update({ where: { id: outreachId }, data: { status: "REPLIED", repliedAt: now } }),
    prisma.business.update({ where: { id: outreach.businessId }, data: { status: "REPLIED", lastContactDate: now } }),
    prisma.statusEvent.create({ data: { businessId: outreach.businessId, status: "REPLIED" } }),
  ]);
  await logEvent({ type: "APPROVAL_ACTION", message: "Marked outreach as replied", businessId: outreach.businessId, metadata: { outreachId } });

  // Mirror into Airtable: Outreach.status="Replied", Leads.status="Replied".
  await syncOutreachStatusToAirtable(outreach, "Replied").catch((err) =>
    logError("Airtable outreach-replied sync failed", err, { outreachId })
  );

  return { ok: true };
}

export async function markBusinessInterested(businessId: string): Promise<ActionResult> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { ok: false, error: "Business not found" };

  await prisma.$transaction([
    prisma.business.update({ where: { id: businessId }, data: { status: "INTERESTED" } }),
    prisma.statusEvent.create({ data: { businessId, status: "INTERESTED" } }),
  ]);
  await logEvent({ type: "APPROVAL_ACTION", message: "Marked business as interested", businessId });

  await airtableSyncStatus(businessId, "Interested").catch((err) =>
    logError("Airtable lead-interested sync failed", err, { businessId })
  );

  return { ok: true };
}

export async function closeBusiness(businessId: string, won: boolean): Promise<ActionResult> {
  const status = won ? "CLOSED_WON" : "CLOSED_LOST";
  await prisma.$transaction([
    prisma.business.update({ where: { id: businessId }, data: { status } }),
    prisma.statusEvent.create({ data: { businessId, status } }),
  ]);
  await logEvent({ type: "APPROVAL_ACTION", message: `Marked business as ${status}`, businessId });

  await airtableSyncStatus(businessId, "Closed").catch((err) =>
    logError("Airtable lead-closed sync failed", err, { businessId })
  );

  return { ok: true };
}
