"use client";
import * as React from "react";
import { subDays, subMonths, subYears, format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type RangeKey = "7d" | "30d" | "90d" | "6m" | "1y" | "all" | "custom";

export interface DateRange {
  key: RangeKey;
  dateFrom?: string;
  dateTo?: string;
}

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

export function presetToRange(key: RangeKey): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  switch (key) {
    case "7d":
      return { dateFrom: subDays(now, 7).toISOString() };
    case "30d":
      return { dateFrom: subDays(now, 30).toISOString() };
    case "90d":
      return { dateFrom: subDays(now, 90).toISOString() };
    case "6m":
      return { dateFrom: subMonths(now, 6).toISOString() };
    case "1y":
      return { dateFrom: subYears(now, 1).toISOString() };
    default:
      return {};
  }
}

export function TimeRangePicker({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange({ key: p.key, ...presetToRange(p.key) })}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value.key === p.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
          )}
        >
          {p.label}
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              value.key === "custom" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            )}
          >
            {value.key === "custom" && value.dateFrom
              ? `${format(new Date(value.dateFrom), "MMM d")} – ${value.dateTo ? format(new Date(value.dateTo), "MMM d") : "now"}`
              : "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>From</Label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>To</Label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
            <Button
              size="sm"
              disabled={!customFrom}
              onClick={() => {
                onChange({
                  key: "custom",
                  dateFrom: new Date(customFrom).toISOString(),
                  dateTo: customTo ? new Date(customTo).toISOString() : undefined,
                });
                setOpen(false);
              }}
            >
              Apply range
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
