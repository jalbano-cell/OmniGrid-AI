import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScoreBadge } from "@/components/shared/score-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ScanSearch, ShieldCheck, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import type { Audit } from "@prisma/client";

const SUB_SCORES: { key: keyof Audit; label: string }[] = [
  { key: "uiuxScore", label: "UI/UX" },
  { key: "mobileScore", label: "Mobile" },
  { key: "navigationScore", label: "Navigation" },
  { key: "accessibilityScore", label: "Accessibility" },
  { key: "seoScore", label: "SEO" },
  { key: "performanceScore", label: "Performance" },
  { key: "ctaScore", label: "Calls to Action" },
  { key: "trustScore", label: "Trust Signals" },
  { key: "brandScore", label: "Brand Consistency" },
];

interface ScoreBreakdownPart {
  score: number;
  reasoning: string;
}

interface ScoreBreakdown {
  websiteQuality: ScoreBreakdownPart;
  businessPotential: ScoreBreakdownPart;
  conversionOpportunity: ScoreBreakdownPart;
  designWeaknessSeverity: ScoreBreakdownPart;
  serviceValue: { level: "high" | "medium" | "low"; reasoning: string };
}

const BREAKDOWN_ROWS: { key: keyof Omit<ScoreBreakdown, "serviceValue">; label: string }[] = [
  { key: "websiteQuality", label: "Website Quality" },
  { key: "businessPotential", label: "Business Potential" },
  { key: "conversionOpportunity", label: "Conversion Opportunity" },
  { key: "designWeaknessSeverity", label: "Design Weakness Severity" },
];

const SERVICE_VALUE_STYLE: Record<string, string> = {
  high: "text-[oklch(0.72_0.14_165)]",
  medium: "text-[oklch(0.75_0.14_75)]",
  low: "text-muted-foreground",
};

export function AuditHistory({ audits }: { audits: Audit[] }) {
  if (audits.length === 0) {
    return <EmptyState icon={ScanSearch} title="No audits yet" description="Run a website audit from the header above." />;
  }

  return (
    <Accordion type="single" collapsible defaultValue={audits[0]?.id} className="space-y-3">
      {audits.map((audit) => (
        <AccordionItem key={audit.id} value={audit.id} className="rounded-lg border border-border/60 px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 flex-1">
              <ScoreBadge score={audit.overallScore} />
              <div className="text-left">
                <p className="text-sm font-medium">Overall {audit.overallScore}/100</p>
                <p className="text-xs text-muted-foreground">{format(audit.createdAt, "MMM d, yyyy h:mm a")}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 mr-3">
                {audit.hasSsl ? (
                  <ShieldCheck className="h-4 w-4 text-[oklch(0.7_0.14_165)]" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                )}
                <ScoreBadge score={audit.opportunityScore} size="sm" />
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-5 pb-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {SUB_SCORES.map(({ key, label }) => (
                <div key={key} className="text-center">
                  <ScoreBadge score={audit[key] as number} size="sm" />
                  <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>

            {audit.scoreBreakdown && (
              <div className="rounded-md border border-border/60 p-3 space-y-2.5">
                <p className="text-xs font-medium">Score Breakdown &amp; Reasoning</p>
                {BREAKDOWN_ROWS.map(({ key, label }) => {
                  const part = (audit.scoreBreakdown as unknown as ScoreBreakdown)[key];
                  if (!part) return null;
                  return (
                    <div key={key} className="flex gap-3 text-xs">
                      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{part.score}</span>
                      <div>
                        <p className="font-medium">{label}</p>
                        <p className="text-muted-foreground">{part.reasoning}</p>
                      </div>
                    </div>
                  );
                })}
                {(audit.scoreBreakdown as unknown as ScoreBreakdown).serviceValue && (
                  <div className="flex gap-3 text-xs">
                    <span
                      className={`w-10 shrink-0 uppercase font-medium ${
                        SERVICE_VALUE_STYLE[(audit.scoreBreakdown as unknown as ScoreBreakdown).serviceValue.level] ?? ""
                      }`}
                    >
                      {(audit.scoreBreakdown as unknown as ScoreBreakdown).serviceValue.level}
                    </span>
                    <div>
                      <p className="font-medium">Service Value</p>
                      <p className="text-muted-foreground">{(audit.scoreBreakdown as unknown as ScoreBreakdown).serviceValue.reasoning}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-[oklch(0.72_0.14_165)] mb-1.5">Strengths</p>
                <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                  {(audit.strengths as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-destructive mb-1.5">Weaknesses</p>
                <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                  {(audit.weaknesses as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5">Recommended Improvements</p>
              <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                {(audit.recommendations as string[]).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            {(audit.brokenLinks as string[]).length > 0 && (
              <div>
                <p className="text-xs font-medium text-destructive mb-1.5">Broken Links</p>
                <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                  {(audit.brokenLinks as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
