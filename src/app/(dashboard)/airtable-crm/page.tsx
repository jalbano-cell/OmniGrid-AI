import Link from "next/link";
import { isAirtableConfigured, airtableListLeads, airtableListOutreach } from "@/lib/services/airtable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/shared/empty-state";
import { Table2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const LEAD_FILTERS = {
  all: { label: "All", formula: undefined },
  "score-80": { label: "Score > 80", formula: "{score} > 80" },
  "status-new": { label: "Status = New", formula: '{status} = "New"' },
} as const;

const OUTREACH_FILTERS = {
  all: { label: "All", formula: undefined },
  "pending-approval": { label: "Status = Pending Approval", formula: '{status} = "Pending Approval"' },
} as const;

type LeadFilterKey = keyof typeof LEAD_FILTERS;
type OutreachFilterKey = keyof typeof OUTREACH_FILTERS;

export default async function AirtableCrmPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; leadFilter?: string; outreachFilter?: string }>;
}) {
  const { tab, leadFilter, outreachFilter } = await searchParams;
  const activeTab = tab === "outreach" ? "outreach" : "leads";
  const activeLeadFilter: LeadFilterKey = leadFilter && leadFilter in LEAD_FILTERS ? (leadFilter as LeadFilterKey) : "all";
  const activeOutreachFilter: OutreachFilterKey =
    outreachFilter && outreachFilter in OUTREACH_FILTERS ? (outreachFilter as OutreachFilterKey) : "all";

  const configured = isAirtableConfigured();

  const [leads, outreach] = configured
    ? await Promise.all([
        airtableListLeads(LEAD_FILTERS[activeLeadFilter].formula),
        airtableListOutreach(OUTREACH_FILTERS[activeOutreachFilter].formula),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Airtable CRM</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Read directly from Airtable — the synced mirror of your pipeline. Postgres remains the app&apos;s source of truth; this view is here so the team can trust what&apos;s in Airtable matches.
        </p>
      </div>

      {!configured && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Airtable isn&apos;t configured</AlertTitle>
          <AlertDescription>
            Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env to enable CRM sync. See .env.example for the required table/field setup.
          </AlertDescription>
        </Alert>
      )}

      {configured && (
        <Tabs value={activeTab}>
          <TabsList>
            <TabsTrigger value="leads" asChild>
              <Link href="/airtable-crm?tab=leads">Leads ({leads.length})</Link>
            </TabsTrigger>
            <TabsTrigger value="outreach" asChild>
              <Link href="/airtable-crm?tab=outreach">Outreach ({outreach.length})</Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-4 space-y-3">
            <div className="flex gap-2">
              {(Object.keys(LEAD_FILTERS) as LeadFilterKey[]).map((key) => (
                <Button key={key} size="sm" variant={activeLeadFilter === key ? "default" : "outline"} asChild>
                  <Link href={`/airtable-crm?tab=leads&leadFilter=${key}`}>{LEAD_FILTERS[key].label}</Link>
                </Button>
              ))}
            </div>

            {leads.length === 0 ? (
              <EmptyState icon={Table2} title="No matching leads in Airtable" />
            ) : (
              <div className="rounded-lg border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.recordId}>
                        <TableCell className="font-medium">{lead.fields.businessName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.fields.industry}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.fields.location}</TableCell>
                        <TableCell className="tabular-nums">{lead.fields.score ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{lead.fields.status ?? "—"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="outreach" className="mt-4 space-y-3">
            <div className="flex gap-2">
              {(Object.keys(OUTREACH_FILTERS) as OutreachFilterKey[]).map((key) => (
                <Button key={key} size="sm" variant={activeOutreachFilter === key ? "default" : "outline"} asChild>
                  <Link href={`/airtable-crm?tab=outreach&outreachFilter=${key}`}>{OUTREACH_FILTERS[key].label}</Link>
                </Button>
              ))}
            </div>

            {outreach.length === 0 ? (
              <EmptyState icon={Table2} title="No matching outreach records in Airtable" />
            ) : (
              <div className="rounded-lg border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outreach.map((row) => (
                      <TableRow key={row.recordId}>
                        <TableCell className="font-medium max-w-96 truncate">{row.fields.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(row.fields.status === "Pending Approval" && "text-[oklch(0.78_0.15_75)]")}>
                            {row.fields.status ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.fields.sentAt ? new Date(row.fields.sentAt).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
