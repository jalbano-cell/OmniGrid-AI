import { prisma } from "@/lib/db/prisma";
import { getSettings } from "@/lib/services/settings";
import { LeadSearchForm } from "@/components/leads/lead-search-form";
import { LeadsTable } from "@/components/leads/leads-table";
import { isWebSearchConfigured } from "@/lib/tools/webSearch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default async function LeadsPage() {
  const [settings, businesses] = await Promise.all([
    getSettings(),
    prisma.business.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Lead Finder</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search by industry and city to discover new businesses. Duplicates are skipped automatically.
        </p>
      </div>

      {!isWebSearchConfigured() && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Web search isn&apos;t configured</AlertTitle>
          <AlertDescription>
            Set TAVILY_API_KEY in .env to enable lead discovery. See .env.example for setup steps.
          </AlertDescription>
        </Alert>
      )}

      <LeadSearchForm industries={settings.industries as string[]} cities={settings.cities as string[]} />
      <LeadsTable businesses={businesses} />
    </div>
  );
}
