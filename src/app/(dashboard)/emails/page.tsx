import { prisma } from "@/lib/db/prisma";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailHistoryRow } from "@/components/outreach/email-history-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Mail } from "lucide-react";

export default async function EmailHistoryPage() {
  const emails = await prisma.outreach.findMany({
    where: { status: { not: "DRAFTED" } },
    include: { business: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Email History</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Every email that has left the Outreach Queue.</p>
      </div>

      {emails.length === 0 ? (
        <EmptyState icon={Mail} title="No emails sent yet" description="Approve a draft from the Outreach Queue to see it here." />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Update</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((e) => (
                <EmailHistoryRow key={e.id} outreach={e} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
