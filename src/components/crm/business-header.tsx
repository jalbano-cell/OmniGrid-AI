"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { runAuditAction } from "@/app/actions/audits";
import { generateOutreachAction } from "@/app/actions/outreach";
import { markInterestedAction, closeBusinessAction } from "@/app/actions/outreach";
import { markDoNotContactAction } from "@/app/actions/leads";
import {
  Globe, Mail, Phone, MapPin, ExternalLink, ScanSearch, Sparkles, Loader2,
  ChevronDown, ThumbsUp, ThumbsDown, Ban, Link2,
} from "lucide-react";
import type { Business, Audit } from "@prisma/client";

interface BusinessHeaderProps {
  business: Business;
  latestAudit: Audit | null;
}

export function BusinessHeader({ business, latestAudit }: BusinessHeaderProps) {
  const [pending, startTransition] = useTransition();
  const social = (business.socialLinks as Record<string, string> | null) ?? {};

  function handleAudit() {
    startTransition(async () => {
      const result = await runAuditAction(business.id);
      if (result.ok) toast.success("Audit complete");
      else toast.error(result.error ?? "Audit failed");
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateOutreachAction(business.id);
      if (result.ok) toast.success("Outreach draft generated — check the Outreach Queue");
      else toast.error(result.error ?? "Failed to generate outreach");
    });
  }

  function handleInterested() {
    startTransition(async () => {
      await markInterestedAction(business.id);
      toast.success("Marked as interested");
    });
  }

  function handleClose(won: boolean) {
    startTransition(async () => {
      await closeBusinessAction(business.id, won);
      toast.success(won ? "Marked as closed-won" : "Marked as closed-lost");
    });
  }

  function handleDoNotContact() {
    startTransition(async () => {
      await markDoNotContactAction(business.id);
      toast.success("Marked as do-not-contact");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight">{business.name}</h1>
            <StatusBadge status={business.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {business.industry} · {business.city}
            {business.province ? `, ${business.province}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {business.opportunityScore != null && (
            <div className="text-right mr-2">
              <p className="text-[12px] text-muted-foreground uppercase tracking-wide">Opportunity</p>
              <ScoreBadge score={business.opportunityScore} size="lg" />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleAudit} disabled={pending || !business.website}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {latestAudit ? "Re-audit" : "Run audit"}
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={pending || !latestAudit}>
            <Sparkles className="h-4 w-4" /> Generate outreach
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Status <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleInterested}>
                <ThumbsUp className="h-4 w-4" /> Mark interested
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleClose(true)}>
                <ThumbsUp className="h-4 w-4" /> Close — Won
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleClose(false)}>
                <ThumbsDown className="h-4 w-4" /> Close — Lost
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleDoNotContact}>
                <Ban className="h-4 w-4" /> Do not contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {business.website && (
          <a href={business.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
            <Globe className="h-3.5 w-3.5" /> {business.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {business.email && (
          <a href={`mailto:${business.email}`} className="flex items-center gap-1.5 hover:text-foreground">
            <Mail className="h-3.5 w-3.5" /> {business.email}
          </a>
        )}
        {business.phone && (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> {business.phone}
          </span>
        )}
        {business.address && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {business.address}
          </span>
        )}
        {Object.entries(social).map(([platform, url]) => (
          <a key={platform} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground capitalize">
            <Link2 className="h-3.5 w-3.5" /> {platform}
          </a>
        ))}
      </div>
    </div>
  );
}
