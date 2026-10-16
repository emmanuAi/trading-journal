"use client";
import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export function TradeOutcomesDonut({
  wins,
  losses,
  breakevens,
}: {
  wins: number;
  losses: number;
  breakevens: number;
}) {
  const total = wins + losses + breakevens;
  const data = [
    { name: "Win", value: wins, color: "var(--profit)" },
    { name: "Loss", value: losses, color: "var(--loss)" },
    { name: "Break Even", value: breakevens, color: "var(--muted)" },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No closed trades yet.</p>;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={64} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground">Trades</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {[
          { label: "Win", count: wins, color: "bg-profit" },
          { label: "Loss", count: losses, color: "bg-loss" },
          { label: "Break Even", count: breakevens, color: "bg-muted" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.color}`} />
            <span className="text-muted-foreground w-20">{row.label}</span>
            <span className="font-medium text-foreground">{row.count}</span>
            <span className="text-xs text-muted-foreground">({total > 0 ? ((row.count / total) * 100).toFixed(1) : "0.0"}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
