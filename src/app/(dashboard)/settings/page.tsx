import { prisma } from "@/lib/db/prisma";
import { getSettings } from "@/lib/services/settings";
import { getGoogleAuthStatus } from "@/lib/google/tokenStore";
import { isWebSearchConfigured } from "@/lib/tools/webSearch";
import { isAirtableConfigured } from "@/lib/services/airtable";
import { SettingsForm } from "@/components/settings/settings-form";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { AutomationPanel } from "@/components/settings/automation-panel";

export default async function SettingsPage() {
  const [settings, googleAuth, lastRun] = await Promise.all([
    getSettings(),
    getGoogleAuthStatus(),
    prisma.logEntry.findFirst({ where: { type: "DAILY_RUN" }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure research defaults, limits, and connected tools.</p>
      </div>

      <IntegrationsPanel
        googleConnected={googleAuth.connected}
        googleEmail={googleAuth.connected ? (googleAuth.email ?? null) : null}
        webSearchConfigured={isWebSearchConfigured()}
        anthropicConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
        airtableConfigured={isAirtableConfigured()}
      />

      <AutomationPanel
        cronConfigured={Boolean(process.env.CRON_SECRET)}
        lastRun={lastRun ? { message: lastRun.message, createdAt: lastRun.createdAt } : null}
      />

      <SettingsForm settings={settings} />
    </div>
  );
}
