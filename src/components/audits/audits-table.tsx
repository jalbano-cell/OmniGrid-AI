"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/shared/score-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ScanSearch, ShieldCheck, ShieldAlert, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Audit, Business } from "@prisma/client";

type AuditWithBusiness = Audit & { business: Business };

export function AuditsTable({ audits }: { audits: AuditWithBusiness[] }) {
  const [minOverall, setMinOverall] = useState("");
  const [minOpportunity, setMinOpportunity] = useState("");

  const filtered = useMemo(() => {
    const overallFloor = minOverall === "" ? null : Number(minOverall);
    const opportunityFloor = minOpportunity === "" ? null : Number(minOpportunity);
    return audits.filter((a) => {
      if (overallFloor !== null && a.overallScore < overallFloor) return false;
      if (opportunityFloor !== null && a.opportunityScore < opportunityFloor) return false;
      return true;
    });
  }, [audits, minOverall, minOpportunity]);

  const hasFilters = minOverall !== "" || minOpportunity !== "";

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="min-overall" className="text-xs text-muted-foreground">
            Min Overall
          </Label>
          <Input
            id="min-overall"
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minOverall}
            onChange={(e) => setMinOverall(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="min-opportunity" className="text-xs text-muted-foreground">
            Min Opportunity
          </Label>
          <Input
            id="min-opportunity"
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minOpportunity}
            onChange={(e) => setMinOpportunity(e.target.value)}
            className="w-28"
          />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMinOverall("");
              setMinOpportunity("");
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        {hasFilters && (
          <span className="text-xs text-muted-foreground pb-2">
            {filtered.length} of {audits.length} audits
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ScanSearch} title="No audits match these filters" />
      ) : (
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
              {filtered.map((a) => (
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
      )}
    </div>
  );
}
