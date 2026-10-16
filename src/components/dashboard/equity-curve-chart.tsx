"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { EquityPoint } from "@/lib/calculations";
import { formatCurrency, formatR } from "@/lib/utils";
import { format } from "date-fns";

const PROFIT = "#22C55E";
const LOSS = "#FF253E";

function buildSplitGradientStops(values: number[], baseline: number) {
  const n = values.length;
  if (n === 0) return [{ offset: "0%", color: PROFIT }];
  if (n === 1) return [{ offset: "0%", color: values[0] >= baseline ? PROFIT : LOSS }];

  const stops: { offset: number; color: string }[] = [];
  const colorAt = (v: number) => (v >= baseline ? PROFIT : LOSS);

  stops.push({ offset: 0, color: colorAt(values[0]) });
  for (let i = 1; i < n; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    const prevAbove = prev >= baseline;
    const currAbove = curr >= baseline;
    const x1 = (i - 1) / (n - 1);
    const x2 = i / (n - 1);
    if (prevAbove !== currAbove) {
      const t = (baseline - prev) / (curr - prev || 1);
      const crossX = x1 + t * (x2 - x1);
      stops.push({ offset: crossX, color: colorAt(prev) });
      stops.push({ offset: crossX, color: colorAt(curr) });
    }
  }
  stops.push({ offset: 1, color: colorAt(values[n - 1]) });
  return stops.map((s) => ({ offset: `${(s.offset * 100).toFixed(3)}%`, color: s.color }));
}

export type EquityMode = "balance" | "r";

export function EquityCurveChart({
  points,
  startingBalance,
  currency,
  mode,
}: {
  points: EquityPoint[];
  startingBalance: number;
  currency: string;
  mode: EquityMode;
}) {
  const key = mode === "balance" ? "balance" : "cumulativeR";
  const baseline = mode === "balance" ? startingBalance : 0;
  const values = points.map((p) => p[key]);
  const stops = buildSplitGradientStops(values, baseline);
  const gradientId = `equity-split-${mode}`;

  const data = points.map((p) => ({ ...p, label: format(new Date(p.date), "MMM d, yyyy") }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#267BFF" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#267BFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1D3048" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9AAFC8" }} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis
          tick={{ fontSize: 11, fill: "#9AAFC8" }}
          axisLine={false}
          tickLine={false}
          width={60}
          tickFormatter={(v) => (mode === "balance" ? formatCurrency(v, currency).replace(/\.00$/, "") : `${v.toFixed(1)}R`)}
        />
        <ReferenceLine y={baseline} stroke="#3A4F6E" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{ background: "#0B1B30", border: "1px solid #1D3048", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#F8FAFF" }}
          formatter={(value) => [
            mode === "balance" ? formatCurrency(Number(value), currency) : formatR(Number(value)),
            mode === "balance" ? "Balance" : "Cumulative R",
          ]}
          labelFormatter={(label, payload) => {
            const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
            return p ? `${label}${p.tradeId ? ` · ${p.tradeId}` : ""}` : label;
          }}
        />
        <Area
          type="monotone"
          dataKey={key}
          stroke={`url(#${gradientId})`}
          strokeWidth={2}
          fill={`url(#${gradientId}-fill)`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={true}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
