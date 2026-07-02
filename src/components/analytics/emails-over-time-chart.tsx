"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_INK, CATEGORICAL } from "@/lib/chartPalette";
import { format } from "date-fns";

export function EmailsOverTimeChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="emailsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CATEGORICAL[0]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CATEGORICAL[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.gridline} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(new Date(d), "MMM d")}
          tick={{ fill: CHART_INK.muted, fontSize: 11 }}
          axisLine={{ stroke: CHART_INK.baseline }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          contentStyle={{ background: CHART_INK.surface, border: `1px solid ${CHART_INK.gridline}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: CHART_INK.secondary }}
          labelFormatter={(d) => format(new Date(d as string), "MMM d, yyyy")}
        />
        <Area type="monotone" dataKey="count" name="Emails sent" stroke={CATEGORICAL[0]} strokeWidth={2} fill="url(#emailsGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
