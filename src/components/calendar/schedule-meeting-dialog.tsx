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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scheduleMeetingAction } from "@/app/actions/calendar";
import { CalendarPlus, Loader2 } from "lucide-react";
import type { Business } from "@prisma/client";

export function ScheduleMeetingDialog({ businesses }: { businesses: Pick<Business, "id" | "name" | "email">[] }) {
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string>("");
  const [attendees, setAttendees] = useState("");
  const [datetime, setDatetime] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!businessId || !datetime) {
      toast.error("Choose a business and a date/time");
      return;
    }
    const attendeeList = attendees
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await scheduleMeetingAction({
        businessId,
        attendees: attendeeList,
        datetime: new Date(datetime).toISOString(),
      });
      if (result.ok) {
        toast.success("Discovery call booked");
        setOpen(false);
        setAttendees("");
        setDatetime("");
      } else {
        toast.error(result.error ?? "Failed to book meeting");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus className="h-4 w-4" /> Schedule discovery call
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a 30-minute discovery call</DialogTitle>
          <DialogDescription>
            Only book this once the lead has indicated they want a meeting. This creates a real Google Calendar event.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Business</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Attendee email(s), comma-separated</Label>
            <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="owner@business.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Date & time</Label>
            <Input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Book call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
