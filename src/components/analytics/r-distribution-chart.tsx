"use client";
import * as React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import type { Trade } from "@/lib/types";

export function RDistributionChart({ trades }: { trades: Trade[] }) {
  const values = trades.filter((t) => t.status === "closed" && t.actualR != null).map((t) => t.actualR as number);

  const labels = ["< -2R", "-2 to -1R", "-1 to 0R", "0 to 1R", "1 to 2R", "2 to 3R", "3 to 4R", "> 4R"];
  const counts = new Array(labels.length).fill(0);

  for (const v of values) {
    if (v < -2) counts[0]++;
    else if (v < -1) counts[1]++;
    else if (v < 0) counts[2]++;
    else if (v < 1) counts[3]++;
    else if (v < 2) counts[4]++;
    else if (v < 3) counts[5]++;
    else if (v < 4) counts[6]++;
    else counts[7]++;
  }

  const data = labels.map((label, i) => ({ label, count: counts[i], negative: i < 3 }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#26262a" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #26262a", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#f4f4f5" }} formatter={(v) => [`${v} trades`, ""]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.negative ? "#ef4444" : "#22c55e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
