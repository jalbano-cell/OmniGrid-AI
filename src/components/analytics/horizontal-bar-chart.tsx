"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_INK, CATEGORICAL } from "@/lib/chartPalette";

export function HorizontalBarChart({ data }: { data: { label: string; count: number }[] }) {
  const height = Math.max(160, data.length * 36);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.gridline} horizontal={false} />
        <XAxis type="number" tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fill: CHART_INK.secondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: CHART_INK.gridline, opacity: 0.4 }}
          contentStyle={{ background: CHART_INK.surface, border: `1px solid ${CHART_INK.gridline}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: CHART_INK.secondary }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
