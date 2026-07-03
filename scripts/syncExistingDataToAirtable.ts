/**
 * One-time / repeatable backfill: pushes every existing Business, Audit,
 * Outreach, and Meeting row already in Postgres into Airtable.
 *
 * Safe to run more than once — every write goes through the same
 * find-or-create / recordId-cached functions the live app uses, so nothing
 * gets duplicated. Also drains any previously queued failed syncs first.
 *
 * Usage: npm run sync:airtable
 */
import { prisma } from "../src/lib/db/prisma";
import {
  isAirtableConfigured,
  retryQueuedAirtableSyncs,
  syncLeadToAirtable,
  syncAuditToAirtable,
  syncOutreachCreatedToAirtable,
  syncOutreachStatusToAirtable,
  syncMeetingToAirtable,
  type AirtableOutreachStatus,
} from "../src/lib/services/airtable";

function mapOutreachStatus(status: string): AirtableOutreachStatus {
  switch (status) {
    case "DRAFTED":
      return "Pending Approval";
    case "SENT":
      return "Sent";
    case "REJECTED":
      return "Rejected";
    case "REPLIED":
      return "Replied";
    default:
      return "Pending Approval";
  }
}

async function main() {
  if (!isAirtableConfigured()) {
    console.error("Airtable not configured — set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env first.");
    process.exit(1);
  }

  console.log("Draining any previously queued failed syncs...");
  const queueResult = await retryQueuedAirtableSyncs(500);
  console.log(`  ${queueResult.succeeded}/${queueResult.attempted} queued syncs replayed successfully.`);

  const businesses = await prisma.business.findMany({
    include: { audits: true, outreach: true, meetings: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${businesses.length} lead(s) in Postgres to sync.`);

  let leadCount = 0;
  let auditCount = 0;
  let outreachCount = 0;
  let meetingCount = 0;

  for (const business of businesses) {
    process.stdout.write(`  ${business.name}...`);

    await syncLeadToAirtable(business);
    leadCount++;

    for (const audit of business.audits) {
      if (audit.airtableRecordId) continue; // already synced
      await syncAuditToAirtable(audit, business);
      auditCount++;
    }

    for (const outreach of business.outreach) {
      if (!outreach.airtableRecordId) {
        await syncOutreachCreatedToAirtable(outreach, business);
        outreachCount++;
      }
      // Re-assert current status in case create-time status has since moved on
      // (e.g. a draft that was later sent before this backfill ever ran).
      const refreshed = await prisma.outreach.findUnique({ where: { id: outreach.id } });
      if (refreshed) {
        await syncOutreachStatusToAirtable(
          { ...refreshed, business },
          mapOutreachStatus(refreshed.status)
        );
      }
    }

    for (const meeting of business.meetings) {
      if (meeting.airtableRecordId) continue; // already synced
      await syncMeetingToAirtable(meeting, business);
      meetingCount++;
    }

    console.log(" done");
  }

  console.log("\nBackfill complete:");
  console.log(`  Leads synced:    ${leadCount}`);
  console.log(`  Audits synced:   ${auditCount}`);
  console.log(`  Outreach synced: ${outreachCount}`);
  console.log(`  Meetings synced: ${meetingCount}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Backfill failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
