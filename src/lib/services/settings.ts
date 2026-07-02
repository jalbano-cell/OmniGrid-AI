import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const SINGLETON_ID = 1;

const DEFAULT_INDUSTRIES = ["Restaurants", "Roofers", "Dental Clinics", "HVAC Companies", "Landscapers"];
const DEFAULT_CITIES = ["Toronto", "Hamilton", "Ottawa", "London", "Mississauga"];

/** Fetches the singleton Settings row, creating it with sane defaults on first run. */
export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;

  try {
    return await prisma.settings.create({
      data: {
        id: SINGLETON_ID,
        industries: DEFAULT_INDUSTRIES,
        cities: DEFAULT_CITIES,
      },
    });
  } catch (err) {
    // Concurrent first-requests (e.g. parallel page prerenders) can both see
    // "no row yet" and race to create it. Through Neon's pooled (PgBouncer)
    // connection, upsert's ON CONFLICT doesn't reliably absorb this the way
    // it would on a direct connection, so we handle the race explicitly:
    // if someone else won, just read what they created.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const wonByOther = await prisma.settings.findUnique({ where: { id: SINGLETON_ID } });
      if (wonByOther) return wonByOther;
    }
    throw err;
  }
}

export async function updateSettings(data: {
  industries?: string[];
  cities?: string[];
  dailyResearchLimit?: number;
  dailyEmailApprovalLimit?: number;
  emailSignature?: string;
  agencyName?: string;
  agencyWebsite?: string;
  agencyInfo?: string;
  approvalMode?: boolean;
}) {
  await getSettings(); // ensure row exists
  return prisma.settings.update({ where: { id: SINGLETON_ID }, data });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Leads discovered since midnight — used to enforce the daily research limit. */
export async function getLeadsFoundToday() {
  return prisma.business.count({ where: { createdAt: { gte: startOfToday() } } });
}

/** Emails approved since midnight — used to enforce the daily approval limit. */
export async function getEmailsApprovedToday() {
  return prisma.outreach.count({ where: { approvedAt: { gte: startOfToday() } } });
}
