"use client";
import * as React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import type { GroupStat } from "@/lib/calculations";

const PROFIT = "#22C55E";
const LOSS = "#FF253E";
const ACCENT = "#267BFF";

export function BarStatChart({
  data,
  metric,
  height = 240,
  colorBySign = true,
  valueFormatter,
}: {
  data: GroupStat[];
  metric: "winRate" | "netPnl" | "profitFactor" | "avgR" | "trades";
  height?: number;
  colorBySign?: boolean;
  valueFormatter?: (v: number) => string;
}) {
  const chartData = data.map((d) => ({
    key: d.key,
    value: metric === "winRate" ? d.winRate ?? 0 : metric === "netPnl" ? d.netPnl : metric === "profitFactor" ? (d.profitFactor === Infinity ? 0 : d.profitFactor ?? 0) : metric === "avgR" ? d.avgR ?? 0 : d.trades,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1D3048" vertical={false} />
        <XAxis dataKey="key" tick={{ fontSize: 11, fill: "#9AAFC8" }} axisLine={false} tickLine={false} interval={0} angle={chartData.length > 8 ? -35 : 0} textAnchor={chartData.length > 8 ? "end" : "middle"} height={chartData.length > 8 ? 50 : 24} />
        <YAxis tick={{ fontSize: 11, fill: "#9AAFC8" }} axisLine={false} tickLine={false} width={46} />
        <Tooltip
          contentStyle={{ background: "#0B1B30", border: "1px solid #1D3048", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#F8FAFF" }}
          formatter={(value) => [valueFormatter ? valueFormatter(Number(value)) : Number(value).toFixed(2), ""]}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={colorBySign ? (d.value >= 0 ? PROFIT : LOSS) : ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
