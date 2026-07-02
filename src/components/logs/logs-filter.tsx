"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = ["ALL", "TOOL_CALL", "SEARCH", "AUDIT", "EMAIL_GENERATED", "APPROVAL_ACTION", "CALENDAR_EVENT", "ERROR"];

export function LogsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("type") ?? "ALL";

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL") params.delete("type");
        else params.set("type", value);
        router.push(`/logs?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TYPES.map((t) => (
          <SelectItem key={t} value={t}>
            {t.replaceAll("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
