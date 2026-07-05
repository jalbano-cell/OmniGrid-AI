import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { logEvent, logError } from "@/lib/services/logger";
import { syncOutreachCreatedToAirtable, airtableSyncStatus } from "@/lib/services/airtable";
import { countWords } from "@/lib/services/outreachGenerator";
import type { Business, Outreach } from "@prisma/client";

const FOLLOW_UP_1_AFTER_DAYS = 3;
const FOLLOW_UP_2_AFTER_DAYS = 7;
const MARK_COLD_AFTER_DAYS = 14;

export interface FollowUpRunSummary {
  checked: number;
  followUpsCreated: number;
  markedCold: number;
  errors: number;
}

/**
 * Deterministic follow-up copy — references the original email's subject
 * and its top finding rather than repeating the whole message verbatim, so
 * it doesn't feel like a duplicate of the first email. No hallucination:
 * everything referenced came from the original drafted email.
 */
function buildFollowUpEmail(business: Business, original: Outreach, stage: 1 | 2) {
  const originalTopic = original.subject.replace(/^(re:|fwd:)\s*/i, "");

  if (stage === 1) {
    const subject = `Following up: ${originalTopic}`;
    const body = [
      `Hi ${business.name} team,`,
      ``,
      `Just wanted to follow up on my note about ${originalTopic.toLowerCase()} — I know inboxes get busy, so no worries if it slipped by.`,
      ``,
      `If it's not a priority right now, that's completely fine. If it is, happy to share how it works, no strings attached.`,
      ``,
      `Either way, appreciate you taking a look.`,
    ].join("\n");
    return { subject, body };
  }

  const subject = `One more thing on ${originalTopic}`;
  const body = [
    `Hi ${business.name} team,`,
    ``,
    `Last note from me on this — I don't want to clutter your inbox. I reached out a little while back about ${originalTopic.toLowerCase()}.`,
    ``,
    `If the timing's ever right, I'm still happy to walk through how it works. If not, I'll leave it here and won't keep following up.`,
    ``,
    `All the best either way.`,
  ].join("\n");
  return { subject, body };
}

async function draftFollowUp(business: Business, original: Outreach, stage: 1 | 2): Promise<void> {
  const { subject, body } = buildFollowUpEmail(business, original, stage);
  const summary = `Follow-up #${stage} referencing original outreach "${original.subject}".`;

  const outreach = await prisma.outreach.create({
    data: {
      businessId: business.id,
      auditId: original.auditId,
      subject,
      body,
      summary,
      confidenceScore: 60,
      toEmail: business.email,
      status: "DRAFTED",
      sequenceNumber: stage,
    },
  });

  await prisma.business.update({ where: { id: business.id }, data: { followUpStage: stage } });
  await prisma.statusEvent.create({
    data: { businessId: business.id, status: business.status, note: `Follow-up #${stage} drafted` },
  });

  await logEvent({
    type: "EMAIL_GENERATED",
    message: `Drafted follow-up #${stage} for ${business.name}`,
    businessId: business.id,
    metadata: { outreachId: outreach.id, wordCount: countWords(body) },
  });

  // Same Outreach sync path as any other draft — lands in Airtable as
  // "Pending Approval", so it still requires manual approval before sending.
  await syncOutreachCreatedToAirtable(outreach, business).catch((err) =>
    logError("Airtable follow-up sync failed", err, { businessId: business.id, outreachId: outreach.id })
  );
}

async function markCold(business: Business): Promise<void> {
  await prisma.$transaction([
    prisma.business.update({ where: { id: business.id }, data: { status: "COLD" } }),
    prisma.statusEvent.create({ data: { businessId: business.id, status: "COLD", note: "No reply 14+ days after first contact" } }),
  ]);

  await logEvent({ type: "APPROVAL_ACTION", message: `Marked ${business.name} as Cold (no reply after 14 days)`, businessId: business.id });

  await airtableSyncStatus(business.id, "Closed").catch((err) =>
    logError("Airtable cold-lead sync failed", err, { businessId: business.id })
  );
}

/**
 * Walks every "Contacted" (SENT) business that hasn't replied, drafting
 * follow-up #1 at 3 days, follow-up #2 at 7 days, and marking the lead Cold
 * at 14 days. Every follow-up is a DRAFT requiring the same manual approval
 * as any other outreach — this never sends anything on its own. One
 * business failing never stops the rest from being processed.
 */
export async function runFollowUps(): Promise<FollowUpRunSummary> {
  const summary: FollowUpRunSummary = { checked: 0, followUpsCreated: 0, markedCold: 0, errors: 0 };

  const candidates = await prisma.business.findMany({
    where: { deletedAt: null, status: "SENT", followUpStage: { lt: 2 } },
  });

  for (const business of candidates) {
    summary.checked++;
    try {
      const firstSent = await prisma.outreach.findFirst({
        where: { businessId: business.id, sentAt: { not: null } },
        orderBy: { sentAt: "asc" },
      });
      if (!firstSent?.sentAt) continue;

      const daysSince = differenceInCalendarDays(new Date(), firstSent.sentAt);

      if (daysSince >= MARK_COLD_AFTER_DAYS) {
        await markCold(business);
        summary.markedCold++;
      } else if (business.followUpStage === 1 && daysSince >= FOLLOW_UP_2_AFTER_DAYS) {
        await draftFollowUp(business, firstSent, 2);
        summary.followUpsCreated++;
      } else if (business.followUpStage === 0 && daysSince >= FOLLOW_UP_1_AFTER_DAYS) {
        await draftFollowUp(business, firstSent, 1);
        summary.followUpsCreated++;
      }
    } catch (err) {
      summary.errors++;
      await logError(`Follow-up check failed for ${business.name}`, err, { businessId: business.id });
    }
  }

  return summary;
}
