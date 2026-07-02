"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_INK, STATUS_COLORS, CATEGORICAL } from "@/lib/chartPalette";

const BUCKET_COLORS = [STATUS_COLORS.critical, STATUS_COLORS.serious, CATEGORICAL[2], CATEGORICAL[1], STATUS_COLORS.good];

export function ScoreDistributionChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.gridline} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={{ stroke: CHART_INK.baseline }} tickLine={false} />
        <YAxis tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          cursor={{ fill: CHART_INK.gridline, opacity: 0.4 }}
          contentStyle={{ background: CHART_INK.surface, border: `1px solid ${CHART_INK.gridline}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: CHART_INK.secondary }}
        />
        <Bar dataKey="count" name="Websites" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
