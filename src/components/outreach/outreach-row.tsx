"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  approveOutreachAction,
  rejectOutreachAction,
  editOutreachAction,
} from "@/app/actions/outreach";
import { Eye, Pencil, Check, X, Loader2 } from "lucide-react";
import type { Outreach, Business } from "@prisma/client";

type OutreachWithBusiness = Outreach & { business: Business };

export function OutreachRow({ outreach }: { outreach: OutreachWithBusiness }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [subject, setSubject] = useState(outreach.subject);
  const [body, setBody] = useState(outreach.body);
  const [toEmail, setToEmail] = useState(outreach.toEmail ?? "");
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveOutreachAction(outreach.id, outreach.businessId);
      if (result.ok) toast.success(`Email sent to ${outreach.toEmail}`);
      else toast.error(result.error ?? "Failed to send");
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectOutreachAction(outreach.id, outreach.businessId, "Rejected from queue");
      if (result.ok) toast.success("Draft rejected");
      else toast.error(result.error ?? "Failed to reject");
    });
  }

  function handleSaveEdit() {
    startTransition(async () => {
      const result = await editOutreachAction(outreach.id, outreach.businessId, { subject, body, toEmail });
      if (result.ok) {
        toast.success("Draft updated");
        setEditOpen(false);
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link href={`/crm/${outreach.businessId}`} className="hover:underline">
          {outreach.business.name}
        </Link>
        <p className="text-xs text-muted-foreground font-normal">{outreach.toEmail ?? "no email on file"}</p>
      </TableCell>
      <TableCell className="max-w-80">
        <p className="text-sm truncate">{outreach.subject}</p>
        <p className="text-xs text-muted-foreground truncate">{outreach.summary}</p>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="tabular-nums">
          {outreach.confidenceScore}%
        </Badge>
      </TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleReject} disabled={pending}>
          <X className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={pending || !outreach.toEmail}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this email?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately send the email to <strong>{outreach.toEmail}</strong> via Gmail. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove}>Send email</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit draft</DialogTitle>
            <DialogDescription>Changes are saved to the draft — approving still requires a separate click.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="contact@business.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableRow>
  );
}
