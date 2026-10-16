"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CalendarDay } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MiniCalendar({ days, currency }: { days: Map<string, CalendarDay>; currency: string }) {
  const today = new Date();
  const [viewDate, setViewDate] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const cells = React.useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Monday-first offset
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);

    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({ date: d, inMonth: d.getMonth() === month });
    }
    return out;
  }, [viewDate]);

  const toKey = (d: Date) => d.toISOString().slice(0, 10);
  const todayKey = toKey(today);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }) => {
          const key = toKey(date);
          const day = days.get(key);
          const isToday = key === todayKey;
          const cell = (
            <div
              className={cn(
                "flex h-8 flex-col items-center justify-center rounded-md text-xs transition-colors",
                !inMonth && "text-muted-foreground/30",
                inMonth && !isToday && "text-foreground",
                isToday && "bg-accent text-accent-foreground font-semibold"
              )}
            >
              <span>{date.getDate()}</span>
              {day && inMonth && (
                <span className={cn("mt-0.5 h-1 w-1 rounded-full", day.netPnl > 0 ? "bg-profit" : day.netPnl < 0 ? "bg-loss" : "bg-muted")} />
              )}
            </div>
          );

          if (!day || !inMonth) return <div key={key}>{cell}</div>;

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>{cell}</TooltipTrigger>
              <TooltipContent>
                {day.trades} trade{day.trades === 1 ? "" : "s"} · {formatCurrency(day.netPnl, currency)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
