import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreBadge } from "@/components/shared/score-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ScanSearch, ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Audit, Business } from "@prisma/client";

type AuditWithBusiness = Audit & { business: Business };

export function AuditsTable({ audits }: { audits: AuditWithBusiness[] }) {
  if (audits.length === 0) {
    return (
      <EmptyState
        icon={ScanSearch}
        title="No audits yet"
        description="Run a website audit from a lead's profile or the Needs Audit list above."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Overall</TableHead>
            <TableHead>Opportunity</TableHead>
            <TableHead>SSL</TableHead>
            <TableHead>Contact Info</TableHead>
            <TableHead>Audited</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audits.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                <Link href={`/crm/${a.businessId}`} className="hover:underline">
                  {a.business.name}
                </Link>
                <p className="text-xs text-muted-foreground font-normal truncate max-w-64">{a.url}</p>
              </TableCell>
              <TableCell>
                <ScoreBadge score={a.overallScore} size="sm" />
              </TableCell>
              <TableCell>
                <ScoreBadge score={a.opportunityScore} size="sm" />
              </TableCell>
              <TableCell>
                {a.hasSsl ? (
                  <ShieldCheck className="h-4 w-4 text-[oklch(0.7_0.14_165)]" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {a.contactInfoFound ? "Found" : "Not found"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(a.createdAt, { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
