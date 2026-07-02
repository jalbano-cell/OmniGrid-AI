"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { searchLeadsAction } from "@/app/actions/leads";
import { Loader2, Search } from "lucide-react";

interface LeadSearchFormProps {
  industries: string[];
  cities: string[];
}

export function LeadSearchForm({ industries, cities }: LeadSearchFormProps) {
  const [industry, setIndustry] = useState(industries[0] ?? "");
  const [city, setCity] = useState(cities[0] ?? "");
  const [province, setProvince] = useState("Ontario");
  const [country, setCountry] = useState("Canada");
  const [count, setCount] = useState(10);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!industry.trim() || !city.trim()) {
      toast.error("Industry and city are required");
      return;
    }
    startTransition(async () => {
      const outcome = await searchLeadsAction({ industry, city, province, country, count });
      if (outcome.limitReached && outcome.created === 0) {
        toast.warning("Daily research limit reached — no new leads were fetched.");
        return;
      }
      toast.success(
        `Found ${outcome.created} new lead${outcome.created === 1 ? "" : "s"}` +
          (outcome.skippedDuplicates ? ` · ${outcome.skippedDuplicates} duplicate(s) skipped` : "") +
          (outcome.skippedUnreachable ? ` · ${outcome.skippedUnreachable} unreachable site(s) skipped` : "")
      );
    });
  }

  return (
    <Card className="border-border/60">
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              list="industry-suggestions"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Roofers"
            />
            <datalist id="industry-suggestions">
              {industries.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              list="city-suggestions"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Hamilton"
            />
            <datalist id="city-suggestions">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="province">Province / State</Label>
            <Input id="province" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Ontario" />
          </div>

          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="country">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Canada">Canada</SelectItem>
                <SelectItem value="United States">United States</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 lg:col-span-1 flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="count"># Businesses</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <Button type="submit" disabled={pending} className="mb-0">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
