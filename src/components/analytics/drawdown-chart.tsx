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
            <stop offset="5%" stopColor="#FF253E" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#FF253E" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1D3048" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9AAFC8" }} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis tick={{ fontSize: 11, fill: "#9AAFC8" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ background: "#0B1B30", border: "1px solid #1D3048", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#F8FAFF" }}
          formatter={(v) => [`${Number(v).toFixed(2)}%`, "Drawdown"]}
        />
        <Area type="monotone" dataKey="drawdownPercent" stroke="#FF253E" strokeWidth={1.5} fill="url(#dd-fill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
