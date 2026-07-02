"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { markRepliedAction } from "@/app/actions/outreach";
import { Eye, Reply, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Outreach, Business } from "@prisma/client";

type OutreachWithBusiness = Outreach & { business: Business };

export function EmailHistoryRow({ outreach }: { outreach: OutreachWithBusiness }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleMarkReplied() {
    startTransition(async () => {
      const result = await markRepliedAction(outreach.id, outreach.businessId);
      if (result.ok) toast.success("Marked as replied");
      else toast.error(result.error ?? "Failed");
    });
  }

  const timestamp = outreach.sentAt ?? outreach.rejectedAt ?? outreach.draftedAt;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link href={`/crm/${outreach.businessId}`} className="hover:underline">
          {outreach.business.name}
        </Link>
      </TableCell>
      <TableCell className="max-w-72 truncate text-sm">{outreach.subject}</TableCell>
      <TableCell>
        <StatusBadge status={outreach.status} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {timestamp ? format(timestamp, "MMM d, yyyy h:mm a") : "—"}
      </TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}>
          <Eye className="h-4 w-4" />
        </Button>
        {outreach.status === "SENT" && (
          <Button variant="outline" size="sm" onClick={handleMarkReplied} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Reply className="h-3.5 w-3.5" />}
            Mark replied
          </Button>
        )}
      </TableCell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{outreach.subject}</DialogTitle>
            <DialogDescription>To: {outreach.toEmail ?? "—"}</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-4 max-h-96 overflow-y-auto">
            {outreach.body}
          </div>
        </DialogContent>
      </Dialog>
    </TableRow>
  );
}
