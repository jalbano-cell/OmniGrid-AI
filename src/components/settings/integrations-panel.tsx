"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, LogOut } from "lucide-react";

interface IntegrationsPanelProps {
  googleConnected: boolean;
  googleEmail: string | null;
  webSearchConfigured: boolean;
  anthropicConfigured: boolean;
}

export function IntegrationsPanel({ googleConnected, googleEmail, webSearchConfigured, anthropicConfigured }: IntegrationsPanelProps) {
  const [pending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      if (res.ok) {
        toast.success("Disconnected Google account");
        window.location.reload();
      } else {
        toast.error("Failed to disconnect");
      }
    });
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Integrations</CardTitle>
        <CardDescription>Tools this app can call: web_search, gmail_send, cal_create.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Google (Gmail + Calendar)</p>
            <p className="text-xs text-muted-foreground">{googleConnected ? `Connected as ${googleEmail ?? "unknown"}` : "Required for gmail_send and cal_create"}</p>
          </div>
          {googleConnected ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={pending}>
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" asChild>
              <a href="/api/auth/google">Connect Google</a>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Web Search (Tavily)</p>
            <p className="text-xs text-muted-foreground">Powers the Lead Finder. Set TAVILY_API_KEY in .env.</p>
          </div>
          <ConfigBadge configured={webSearchConfigured} />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Claude (email drafting)</p>
            <p className="text-xs text-muted-foreground">Optional — improves phrasing. Falls back to a template writer if unset.</p>
          </div>
          <ConfigBadge configured={anthropicConfigured} />
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigBadge({ configured }: { configured: boolean }) {
  return (
    <Badge variant="outline" className={configured ? "text-[oklch(0.75_0.15_165)] border-transparent bg-[oklch(0.62_0.14_165_/_0.15)]" : "text-muted-foreground"}>
      {configured ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {configured ? "Configured" : "Not configured"}
    </Badge>
  );
}
