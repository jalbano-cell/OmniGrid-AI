import { prisma } from "@/lib/db/prisma";

const SINGLETON_ID = 1;

const DEFAULT_INDUSTRIES = ["Restaurants", "Roofers", "Dental Clinics", "HVAC Companies", "Landscapers"];
const DEFAULT_CITIES = ["Toronto", "Hamilton", "Ottawa", "London", "Mississauga"];

/** Fetches the singleton Settings row, creating it with sane defaults on first run. */
export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;

  // upsert (not create) — concurrent first-requests (e.g. parallel page
  // prerenders) would otherwise race on the same unique id.
  return prisma.settings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      industries: DEFAULT_INDUSTRIES,
      cities: DEFAULT_CITIES,
    },
    update: {},
  });
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
