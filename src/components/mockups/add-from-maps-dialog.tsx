"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { resolveGoogleMapsLeadAction } from "@/app/actions/mockups";
import { useMockupQueue } from "./mockup-queue-context";
import { MapPin, Loader2, Plus } from "lucide-react";

const EMPTY_FORM = { name: "", industry: "", city: "", province: "", phone: "", notes: "" };

export function AddFromMapsDialog() {
  const { addManualLead } = useMockupQueue();
  const [open, setOpen] = useState(false);
  const [mapsUrl, setMapsUrl] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [looking, startLookup] = useTransition();
  const [saving, startSave] = useTransition();

  function reset() {
    setMapsUrl("");
    setCanonicalUrl(null);
    setForm(EMPTY_FORM);
  }

  function handleLookup() {
    if (!mapsUrl.trim()) {
      toast.error("Paste a Google Maps link first");
      return;
    }
    startLookup(async () => {
      const result = await resolveGoogleMapsLeadAction(mapsUrl.trim());
      if (result.ok) {
        setForm((f) => ({ ...f, name: result.name }));
        setCanonicalUrl(result.canonicalUrl);
        toast.success(`Found: ${result.name}`);
      } else {
        setCanonicalUrl(null);
        toast.error(result.error);
      }
    });
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.industry.trim() || !form.city.trim()) {
      toast.error("Name, industry, and city are required");
      return;
    }
    startSave(async () => {
      await addManualLead({
        name: form.name.trim(),
        industry: form.industry.trim(),
        city: form.city.trim(),
        province: form.province.trim() || undefined,
        phone: form.phone.trim() || undefined,
        googleProfile: canonicalUrl ?? mapsUrl.trim() ?? undefined,
        notes: form.notes.trim() || undefined,
      });
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          <Plus className="h-3 w-3" /> Add from Maps
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a lead from Google Maps</DialogTitle>
          <DialogDescription>
            For a business you found yourself outside of Lead Finder — usually one with no website of its own, so it
            skips straight to the mockup queue instead of a website audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="maps-url">Google Maps link</Label>
            <div className="flex gap-2">
              <Input
                id="maps-url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
              />
              <Button type="button" variant="outline" onClick={handleLookup} disabled={looking}>
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Look up
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maps-name">Business name</Label>
            <Input
              id="maps-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Confirmed/edit after lookup, or type it in"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="maps-industry">Industry</Label>
              <Input
                id="maps-industry"
                value={form.industry}
                onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                placeholder="Roofers"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maps-city">City</Label>
              <Input
                id="maps-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Hamilton"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="maps-province">Province / State (optional)</Label>
              <Input
                id="maps-province"
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maps-phone">Phone (optional)</Label>
              <Input
                id="maps-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maps-notes">Notes (optional)</Label>
            <Input
              id="maps-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Anything worth remembering about this lead"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add to mockup queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
