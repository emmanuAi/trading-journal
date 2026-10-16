import * as React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon,
  delta,
  sparkline,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "neutral" | "profit" | "loss";
  icon?: React.ReactNode;
  /** Small trend badge, e.g. "+12.4%" — sign/color is inferred from the leading character. */
  delta?: string;
  /** Optional tiny inline trend chart. Real, already-computed series only — never synthesized. */
  sparkline?: number[];
}) {
  const deltaPositive = delta?.trim().startsWith("-") ? false : true;
  const chipTone = tone === "loss" ? "loss" : tone === "profit" ? "profit" : "accent";
  const sparkColor = tone === "loss" ? "var(--loss)" : tone === "profit" ? "var(--profit)" : "var(--accent)";

  return (
    <Card className="animate-fade-in overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  chipTone === "profit" && "bg-profit/15 text-profit",
                  chipTone === "loss" && "bg-loss/15 text-loss",
                  chipTone === "accent" && "bg-accent/15 text-accent"
                )}
              >
                {icon}
              </span>
            )}
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div
              className={cn(
                "text-xl font-semibold tracking-tight",
                tone === "profit" && "text-profit",
                tone === "loss" && "text-loss",
                tone === "neutral" && "text-foreground"
              )}
            >
              {value}
            </div>
            {sublabel && <div className="mt-1 text-[11px] text-muted-foreground">{sublabel}</div>}
            {delta && (
              <div className={cn("mt-1 flex items-center gap-0.5 text-[11px] font-medium", deltaPositive ? "text-profit" : "text-loss")}>
                {deltaPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {delta}
              </div>
            )}
          </div>

          {sparkline && sparkline.length > 1 && (
            <div className="h-10 w-20 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${label.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={sparkColor} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={sparkColor}
                    strokeWidth={1.5}
                    fill={`url(#spark-${label.replace(/\s+/g, "-")})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
