"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/settings/tag-input";
import { updateSettingsAction } from "@/app/actions/settings";
import { Loader2, Save } from "lucide-react";
import type { Settings } from "@prisma/client";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [industries, setIndustries] = useState<string[]>(settings.industries as string[]);
  const [cities, setCities] = useState<string[]>(settings.cities as string[]);
  const [dailyResearchLimit, setDailyResearchLimit] = useState(settings.dailyResearchLimit);
  const [dailyEmailApprovalLimit, setDailyEmailApprovalLimit] = useState(settings.dailyEmailApprovalLimit);
  const [emailSignature, setEmailSignature] = useState(settings.emailSignature);
  const [agencyName, setAgencyName] = useState(settings.agencyName);
  const [agencyWebsite, setAgencyWebsite] = useState(settings.agencyWebsite);
  const [agencyInfo, setAgencyInfo] = useState(settings.agencyInfo);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateSettingsAction({
        industries,
        cities,
        dailyResearchLimit,
        dailyEmailApprovalLimit,
        emailSignature,
        agencyName,
        agencyWebsite,
        agencyInfo,
      });
      toast.success("Settings saved");
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Lead Finder Defaults</CardTitle>
          <CardDescription>Suggested industries and cities shown in the Lead Finder search form.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Industries</Label>
            <TagInput value={industries} onChange={setIndustries} placeholder="Add an industry and press Enter" />
          </div>
          <div className="space-y-1.5">
            <Label>Cities</Label>
            <TagInput value={cities} onChange={setCities} placeholder="Add a city and press Enter" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily Limits</CardTitle>
          <CardDescription>Guardrails to keep research and outreach volume sane.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Daily research limit (new leads/day)</Label>
            <Input type="number" min={1} value={dailyResearchLimit} onChange={(e) => setDailyResearchLimit(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Daily email approval limit</Label>
            <Input type="number" min={1} value={dailyEmailApprovalLimit} onChange={(e) => setDailyEmailApprovalLimit(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Agency &amp; Signature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Agency name</Label>
              <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Your Agency Inc." />
            </div>
            <div className="space-y-1.5">
              <Label>Agency website</Label>
              <Input value={agencyWebsite} onChange={(e) => setAgencyWebsite(e.target.value)} placeholder="https://youragency.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Agency info (used as context, never fabricated into claims)</Label>
            <Textarea value={agencyInfo} onChange={(e) => setAgencyInfo(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Email signature</Label>
            <Textarea value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)} rows={4} placeholder={"Jane Doe\nYour Agency Inc.\n(555) 555-5555"} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Approval Mode</CardTitle>
          <CardDescription>
            OmniGrid AI never sends an email without a manual Approve click — this safety guarantee cannot be turned off in this build.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked disabled />
            <span className="text-sm text-muted-foreground">Manual approval required for every email (always on)</span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
