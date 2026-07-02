import { prisma } from "@/lib/db/prisma";

export interface OverviewStats {
  leadsFound: number;
  auditsCompleted: number;
  emailsDrafted: number;
  emailsSent: number;
  replyRate: number; // 0-100
  meetingsBooked: number;
  conversionRate: number; // 0-100, closed-won / sent
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const [leadsFound, auditsCompleted, emailsDrafted, emailsSent, repliedCount, meetingsBooked, closedWon] =
    await Promise.all([
      prisma.business.count(),
      prisma.audit.count(),
      prisma.outreach.count(),
      prisma.outreach.count({ where: { sentAt: { not: null } } }),
      prisma.outreach.count({ where: { repliedAt: { not: null } } }),
      prisma.meeting.count(),
      prisma.business.count({ where: { status: "CLOSED_WON" } }),
    ]);

  const replyRate = emailsSent > 0 ? Math.round((repliedCount / emailsSent) * 100) : 0;
  const conversionRate = emailsSent > 0 ? Math.round((closedWon / emailsSent) * 100) : 0;

  return { leadsFound, auditsCompleted, emailsDrafted, emailsSent, replyRate, meetingsBooked, conversionRate };
}

export async function getEmailsSentOverTime(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await prisma.outreach.findMany({
    where: { sentAt: { gte: since } },
    select: { sentAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    if (!row.sentAt) continue;
    const key = row.sentAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

export async function getTopIndustries(limit = 8) {
  const rows = await prisma.business.groupBy({
    by: ["industry"],
    _count: { industry: true },
    orderBy: { _count: { industry: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ label: r.industry, count: r._count.industry }));
}

export async function getTopCities(limit = 8) {
  const rows = await prisma.business.groupBy({
    by: ["city"],
    _count: { city: true },
    orderBy: { _count: { city: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ label: r.city, count: r._count.city }));
}

export async function getAverageWebsiteScore() {
  const result = await prisma.audit.aggregate({ _avg: { overallScore: true } });
  return Math.round(result._avg.overallScore ?? 0);
}

export async function getPipelineStages() {
  const rows = await prisma.business.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  return rows.map((r) => ({ status: r.status, count: r._count.status }));
}

export async function getScoreDistribution() {
  const audits = await prisma.audit.findMany({ select: { overallScore: true } });
  const buckets = [
    { label: "0-20", min: 0, max: 20, count: 0 },
    { label: "21-40", min: 21, max: 40, count: 0 },
    { label: "41-60", min: 41, max: 60, count: 0 },
    { label: "61-80", min: 61, max: 80, count: 0 },
    { label: "81-100", min: 81, max: 100, count: 0 },
  ];
  for (const a of audits) {
    const bucket = buckets.find((b) => a.overallScore >= b.min && a.overallScore <= b.max);
    if (bucket) bucket.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}
