"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { runAuditAction } from "@/app/actions/audits";
import { deleteBusinessAction } from "@/app/actions/leads";
import { useMockupQueue } from "@/components/mockups/mockup-queue-context";
import { MoreHorizontal, ScanSearch, Trash2, ExternalLink, Users, Loader2, LayoutTemplate } from "lucide-react";
import type { Business } from "@prisma/client";

export function LeadsTable({ businesses }: { businesses: Business[] }) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { addBusiness } = useMockupQueue();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.industry.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        (b.website ?? "").toLowerCase().includes(q)
    );
  }, [businesses, query]);

  function handleAudit(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await runAuditAction(id);
      setPendingId(null);
      if (result.ok) toast.success("Website audit complete");
      else toast.error(result.error ?? "Audit failed");
    });
  }

  function handleDelete(id: string, name: string) {
    startTransition(async () => {
      await deleteBusinessAction(id);
      toast.success(`Removed ${name}`);
    });
  }

  function handleSendToMockup(id: string) {
    startTransition(async () => {
      await addBusiness(id);
    });
  }

  if (businesses.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No leads yet"
        description="Use the search above to discover businesses by industry and city."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filter leads by name, industry, city…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-lg border border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <Link href={`/crm/${b.id}`} className="hover:underline">
                    {b.name}
                  </Link>
                  {b.website && (
                    <a
                      href={b.website}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1.5 text-muted-foreground hover:text-foreground inline-flex align-middle"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{b.industry}</TableCell>
                <TableCell className="text-muted-foreground">{b.city}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {b.email ?? b.phone ?? <span className="italic">none found</span>}
                </TableCell>
                <TableCell>{b.opportunityScore != null ? <ScoreBadge score={b.opportunityScore} size="sm" /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <StatusBadge status={b.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {pendingId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/crm/${b.id}`}>View profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAudit(b.id)} disabled={!b.website}>
                        <ScanSearch className="h-4 w-4" /> Run website audit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendToMockup(b.id)}>
                        <LayoutTemplate className="h-4 w-4" /> Send to mockup
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(b.id, b.name)}>
                        <Trash2 className="h-4 w-4" /> Delete lead
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
