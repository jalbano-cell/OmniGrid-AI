import { prisma } from "@/lib/db/prisma";
import { PendingAuditsList } from "@/components/audits/pending-audits-list";
import { AuditsTable } from "@/components/audits/audits-table";

export default async function AuditsPage() {
  const [audits, pendingBusinesses] = await Promise.all([
    prisma.audit.findMany({
      include: { business: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.business.findMany({
      where: { deletedAt: null, website: { not: null }, audits: { none: {} } },
      select: { id: true, name: true, website: true, city: true, industry: true },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Website Audits</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Every audit is grounded in the site&apos;s actual HTML — nothing here is guessed.
        </p>
      </div>

      <PendingAuditsList businesses={pendingBusinesses} />
      <AuditsTable audits={audits} />
    </div>
  );
}
