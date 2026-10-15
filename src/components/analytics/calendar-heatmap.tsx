"use client";
import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CalendarDay } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";

function colorFor(pnl: number, maxAbs: number) {
  if (pnl === 0 || maxAbs === 0) return "bg-surface-2";
  const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
  if (pnl > 0) {
    if (intensity > 0.66) return "bg-profit";
    if (intensity > 0.33) return "bg-profit/60";
    return "bg-profit/30";
  }
  if (intensity > 0.66) return "bg-loss";
  if (intensity > 0.33) return "bg-loss/60";
  return "bg-loss/30";
}

export function CalendarHeatmap({ days, weeks = 18, currency }: { days: Map<string, CalendarDay>; weeks?: number; currency: string }) {
  const today = new Date();
  const maxAbs = Math.max(1, ...Array.from(days.values()).map((d) => Math.abs(d.netPnl)));

  const cells: { date: string; day: CalendarDay | null }[][] = [];
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - totalDays + 1);
  // Align start to Sunday
  start.setDate(start.getDate() - start.getDay());

  for (let w = 0; w < weeks; w++) {
    const col: { date: string; day: CalendarDay | null }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      col.push({ date: key, day: days.get(key) ?? null });
    }
    cells.push(col);
  }

  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1">
      {cells.map((col, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {col.map(({ date, day }) => (
            <Tooltip key={date}>
              <TooltipTrigger asChild>
                <div className={`h-3 w-3 rounded-sm ${day ? colorFor(day.netPnl, maxAbs) : "bg-surface-2/50"}`} />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-medium">{date}</div>
                  {day ? (
                    <div className={day.netPnl >= 0 ? "text-profit" : "text-loss"}>
                      {formatCurrency(day.netPnl, currency)} · {day.trades} trade{day.trades > 1 ? "s" : ""}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No trades</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  );
}
