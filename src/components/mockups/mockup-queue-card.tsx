"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, ClipboardCopy, Eye, Link2, MessageSquareText, CheckCircle2, X } from "lucide-react";
import type { MockupStatus } from "@prisma/client";
import { useMockupQueue } from "./mockup-queue-context";
import type { MockupQueueItemWithBusiness } from "@/app/actions/mockups";

const STATUS_OPTIONS: { value: MockupStatus; label: string }[] = [
  { value: "QUEUED", label: "Queued" },
  { value: "BUILDING", label: "Building" },
  { value: "LIVE", label: "Live" },
  { value: "SENT", label: "Sent" },
  { value: "REPLIED", label: "Replied" },
  { value: "BOOKED", label: "Booked" },
];

/** notesOverride lets callers pass the in-progress notes draft so copy/preview never shows a stale, not-yet-saved value. */
function buildPrompt(item: MockupQueueItemWithBusiness, notesOverride?: string) {
  const { business } = item;
  const location = [business.city, business.province].filter(Boolean).join(", ");
  const contact = business.phone ?? "no phone on file";
  const siteState = business.website ? "an outdated site" : "no website";
  const base = `Build a polished one-page demo website for ${business.name}, a ${business.industry} in ${location}. Contact: ${contact}. They currently have ${siteState}. Include hero, services, testimonials, and a contact/booking CTA.`;
  const notes = (notesOverride ?? item.notes).trim();
  return notes ? `${base} Additional context from the lead: ${notes}` : base;
}

// Recipient prefilled so the link goes straight to the prospect; iOS and
// Android disagree on the separator before "body" in sms: links.
function buildSmsHref(phone: string | null, url: string) {
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const recipient = phone ? phone.replace(/[^\d+]/g, "") : "";
  const body = encodeURIComponent(url);
  return isIOS ? `sms:${recipient}&body=${body}` : `sms:${recipient}?body=${body}`;
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Couldn't copy to clipboard");
  }
}

export function MockupQueueCard({
  item,
  expanded,
  onToggleExpand,
}: {
  item: MockupQueueItemWithBusiness;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { setStatus, setUrl, setNotes, markSent, remove } = useMockupQueue();
  const [notesDraft, setNotesDraft] = useState(item.notes);
  const [urlDraft, setUrlDraft] = useState(item.deployedUrl ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { business } = item;
  const hasUrl = Boolean(item.deployedUrl);

  return (
    <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/40 p-2 space-y-1.5">
      <div className="flex items-start gap-1.5">
        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <p className="text-xs font-medium text-sidebar-foreground truncate">{business.name}</p>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">
            {business.industry} · {business.city}
          </p>
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-0.5 shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      <Select value={item.status} onValueChange={(value) => setStatus(item.id, value as MockupStatus)}>
        <SelectTrigger size="sm" className="h-6 w-full text-[11px] px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {expanded && (
        <div className="space-y-1.5 pt-0.5">
          <div className="text-[11px] text-sidebar-foreground/60 space-y-0.5">
            <p>{business.phone ?? "No phone on file"}</p>
            <p>{business.website ? "Has a website" : "No website"}</p>
          </div>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              if (notesDraft !== item.notes) setNotes(item.id, notesDraft);
            }}
            placeholder="Notes…"
            className="min-h-12 text-[11px] bg-background/50"
          />
          <Input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onBlur={() => {
              if (urlDraft !== (item.deployedUrl ?? "")) setUrl(item.id, urlDraft);
            }}
            placeholder="Paste live demo link…"
            className="h-7 text-[11px] bg-background/50"
          />
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Preview build prompt"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Preview build prompt</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Copy build prompt"
              onClick={() => copyText(buildPrompt(item, notesDraft), "Build prompt copied")}
            >
              <ClipboardCopy className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy build prompt</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Copy link"
              disabled={!hasUrl}
              onClick={() => hasUrl && copyText(item.deployedUrl as string, "Link copied")}
            >
              <Link2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy link</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Text link"
              disabled={!hasUrl}
              onClick={() => {
                if (!hasUrl) return;
                window.location.href = buildSmsHref(business.phone, item.deployedUrl as string);
              }}
            >
              <MessageSquareText className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Text link</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Mark sent"
              onClick={() => markSent(item.id)}
            >
              <CheckCircle2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark sent</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() => remove(item.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove</TooltipContent>
        </Tooltip>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Build prompt — {business.name}</DialogTitle>
            <DialogDescription>What gets copied when you use the build prompt for this lead.</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
            {buildPrompt(item, notesDraft)}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button onClick={() => copyText(buildPrompt(item, notesDraft), "Build prompt copied")}>
              <ClipboardCopy className="h-4 w-4" /> Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
