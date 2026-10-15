"use client";
import * as React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import type { DrawdownPoint } from "@/lib/calculations";

export function DrawdownChart({ points }: { points: DrawdownPoint[] }) {
  const data = points.map((p) => ({ ...p, label: format(new Date(p.date), "MMM d") }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#26262a" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #26262a", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#f4f4f5" }}
          formatter={(v) => [`${Number(v).toFixed(2)}%`, "Drawdown"]}
        />
        <Area type="monotone" dataKey="drawdownPercent" stroke="#ef4444" strokeWidth={1.5} fill="url(#dd-fill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
