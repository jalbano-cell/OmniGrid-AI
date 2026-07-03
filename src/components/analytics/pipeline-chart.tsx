"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_INK, CATEGORICAL } from "@/lib/chartPalette";

const STAGE_ORDER = [
  "NEW", "DRAFTED", "APPROVED", "SENT", "REPLIED", "INTERESTED",
  "MEETING_SCHEDULED", "CLOSED_WON", "CLOSED_LOST", "DO_NOT_CONTACT", "COLD",
];

const STAGE_LABELS: Record<string, string> = {
  NEW: "New", DRAFTED: "Drafted", APPROVED: "Approved", SENT: "Sent", REPLIED: "Replied",
  INTERESTED: "Interested", MEETING_SCHEDULED: "Meeting Scheduled", CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost", DO_NOT_CONTACT: "Do Not Contact", COLD: "Cold",
};

export function PipelineChart({ data }: { data: { status: string; count: number }[] }) {
  const ordered = STAGE_ORDER.map((status) => ({
    status: STAGE_LABELS[status] ?? status,
    count: data.find((d) => d.status === status)?.count ?? 0,
  })).filter((d) => d.count > 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={ordered} margin={{ top: 8, right: 16, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.gridline} vertical={false} />
        <XAxis
          dataKey="status"
          tick={{ fill: CHART_INK.muted, fontSize: 10 }}
          axisLine={{ stroke: CHART_INK.baseline }}
          tickLine={false}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          cursor={{ fill: CHART_INK.gridline, opacity: 0.4 }}
          contentStyle={{ background: CHART_INK.surface, border: `1px solid ${CHART_INK.gridline}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: CHART_INK.secondary }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {ordered.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
