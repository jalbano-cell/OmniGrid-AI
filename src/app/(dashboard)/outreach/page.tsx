import { prisma } from "@/lib/db/prisma";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutreachRow } from "@/components/outreach/outreach-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Inbox, ShieldCheck } from "lucide-react";
import { getSettings, getEmailsApprovedToday } from "@/lib/services/settings";

export default async function OutreachQueuePage() {
  const [drafts, settings, approvedToday] = await Promise.all([
    prisma.outreach.findMany({
      where: { status: "DRAFTED" },
      include: { business: true },
      orderBy: { draftedAt: "asc" },
    }),
    getSettings(),
    getEmailsApprovedToday(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Outreach Queue</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Nothing sends automatically. Review each draft, then Approve, Edit, or Reject.
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Approval mode is {settings.approvalMode ? "ON" : "OFF"}</AlertTitle>
        <AlertDescription>
          {approvedToday} of {settings.dailyEmailApprovalLimit} daily approvals used today.
        </AlertDescription>
      </Alert>

      {drafts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Queue is empty"
          description="Generate an outreach email from a business's profile — it will show up here for approval."
        />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Draft</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((d) => (
                <OutreachRow key={d.id} outreach={d} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
