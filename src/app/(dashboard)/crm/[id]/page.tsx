import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessHeader } from "@/components/crm/business-header";
import { AuditHistory } from "@/components/crm/audit-history";
import { CrmOutreachPanel } from "@/components/crm/crm-outreach-panel";
import { NotesPanel } from "@/components/crm/notes-panel";
import { CrmMeetingsPanel } from "@/components/crm/crm-meetings-panel";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      audits: { orderBy: { createdAt: "desc" } },
      outreach: { orderBy: { updatedAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      meetings: { orderBy: { datetime: "desc" } },
      statusEvents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!business) notFound();

  const latestAudit = business.audits[0] ?? null;

  return (
    <div className="space-y-6">
      <BusinessHeader business={business} latestAudit={latestAudit} />

      {business.lastContactDate && (
        <p className="text-xs text-muted-foreground">
          Last contact {formatDistanceToNow(business.lastContactDate, { addSuffix: true })}
        </p>
      )}

      <Tabs defaultValue="audits">
        <TabsList>
          <TabsTrigger value="audits">Website Audits ({business.audits.length})</TabsTrigger>
          <TabsTrigger value="outreach">Emails ({business.outreach.length})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({business.meetings.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({business.notes.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="audits" className="mt-4">
          <AuditHistory audits={business.audits} />
        </TabsContent>
        <TabsContent value="outreach" className="mt-4">
          <CrmOutreachPanel outreach={business.outreach} />
        </TabsContent>
        <TabsContent value="meetings" className="mt-4">
          <CrmMeetingsPanel meetings={business.meetings} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesPanel businessId={business.id} notes={business.notes} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="divide-y divide-border/60">
              {business.statusEvents.map((e) => (
                <div key={e.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-sm">
                  <span>{e.status.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(e.createdAt, { addSuffix: true })}</span>
                </div>
              ))}
              {business.statusEvents.length === 0 && <p className="text-xs text-muted-foreground py-2">No status changes yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
