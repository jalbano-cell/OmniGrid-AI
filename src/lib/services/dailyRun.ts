import { prisma } from "@/lib/db/prisma";
import { discoverLeads } from "@/lib/services/leadDiscovery";
import { runWebsiteAudit } from "@/lib/audit/engine";
import { generateOutreachEmail } from "@/lib/services/outreachGenerator";
import { runFollowUps } from "@/lib/services/followUpService";
import { retryQueuedAirtableSyncs } from "@/lib/services/airtable";
import { logEvent, logError } from "@/lib/services/logger";
import { getLeadsFoundToday, getSettings } from "@/lib/services/settings";

const EMAIL_SCORE_THRESHOLD = 70;
const LEADS_PER_PAIR = 3;
const MAX_AUDITS_PER_RUN = 25;
const MAX_EMAILS_PER_RUN = 25;

export interface DailyRunSummary {
  leadsFound: number;
  leadsFiltered: number;
  auditsCompleted: number;
  auditErrors: number;
  emailsGenerated: number;
  emailErrors: number;
  followUpsCreated: number;
  leadsMarkedCold: number;
  airtableRetried: number;
  airtableRetrySucceeded: number;
}

/**
 * The full daily autonomous pipeline: discover → filter → audit
 * high-quality leads → draft emails for high-scoring leads → run follow-ups
 * → drain the Airtable retry queue. Every step is wrapped so one lead's
 * failure never stops the rest of the run; a single summary is logged at
 * the end. Nothing here ever sends an email — approval always stays manual.
 */
export async function runDailyPipeline(): Promise<DailyRunSummary> {
  const summary: DailyRunSummary = {
    leadsFound: 0,
    leadsFiltered: 0,
    auditsCompleted: 0,
    auditErrors: 0,
    emailsGenerated: 0,
    emailErrors: 0,
    followUpsCreated: 0,
    leadsMarkedCold: 0,
    airtableRetried: 0,
    airtableRetrySucceeded: 0,
  };

  const settings = await getSettings();
  const industries = settings.industries as string[];
  const cities = settings.cities as string[];

  // Step 1 + 2: discover new leads across each industry×city pair, stopping
  // early once the daily research limit is hit (discoverLeads enforces this
  // per-call, but we also check up front to avoid burning search calls).
  outer: for (const industry of industries) {
    for (const city of cities) {
      const foundToday = await getLeadsFoundToday();
      if (foundToday >= settings.dailyResearchLimit) break outer;

      try {
        const outcome = await discoverLeads({ industry, city, count: LEADS_PER_PAIR });
        summary.leadsFound += outcome.created;
        summary.leadsFiltered += outcome.skippedLowQuality;
      } catch (err) {
        await logError(`Daily run: lead discovery failed for ${industry} in ${city}`, err);
      }
    }
  }

  // Step 3: audit only leads that don't have one yet (the quality filter in
  // discoverLeads already kept obviously bad leads out of the database).
  const needsAudit = await prisma.business.findMany({
    where: { audits: { none: {} } },
    orderBy: { createdAt: "asc" },
    take: MAX_AUDITS_PER_RUN,
  });
  for (const business of needsAudit) {
    try {
      const result = await runWebsiteAudit(business.id);
      if (result.ok) summary.auditsCompleted++;
      else summary.auditErrors++;
    } catch (err) {
      summary.auditErrors++;
      await logError(`Daily run: audit failed for ${business.name}`, err, { businessId: business.id });
    }
  }

  // Step 4: draft emails only for leads scoring >= 70 that don't already
  // have an outreach draft/send.
  const highScoreLeads = await prisma.business.findMany({
    where: { opportunityScore: { gte: EMAIL_SCORE_THRESHOLD }, outreach: { none: {} } },
    include: { audits: { orderBy: { createdAt: "desc" }, take: 1 } },
    take: MAX_EMAILS_PER_RUN,
  });
  for (const business of highScoreLeads) {
    const audit = business.audits[0];
    if (!audit) continue;
    try {
      const result = await generateOutreachEmail(business.id, audit.id);
      if (result.ok) summary.emailsGenerated++;
      else summary.emailErrors++;
    } catch (err) {
      summary.emailErrors++;
      await logError(`Daily run: email generation failed for ${business.name}`, err, { businessId: business.id });
    }
  }

  // Step 7: follow-up automation (3/7/14-day cadence).
  try {
    const followUps = await runFollowUps();
    summary.followUpsCreated = followUps.followUpsCreated;
    summary.leadsMarkedCold = followUps.markedCold;
  } catch (err) {
    await logError("Daily run: follow-up pass failed", err);
  }

  // Housekeeping: replay anything that failed to sync to Airtable earlier.
  try {
    const retried = await retryQueuedAirtableSyncs(100);
    summary.airtableRetried = retried.attempted;
    summary.airtableRetrySucceeded = retried.succeeded;
  } catch (err) {
    await logError("Daily run: Airtable retry queue drain failed", err);
  }

  await logEvent({
    type: "DAILY_RUN",
    message:
      `Daily run: ${summary.leadsFound} leads found (${summary.leadsFiltered} filtered out), ` +
      `${summary.auditsCompleted} audits completed (${summary.auditErrors} failed), ` +
      `${summary.emailsGenerated} emails drafted (${summary.emailErrors} failed), ` +
      `${summary.followUpsCreated} follow-ups drafted, ${summary.leadsMarkedCold} leads marked Cold`,
    metadata: summary as unknown as Record<string, unknown>,
  });

  return summary;
}
