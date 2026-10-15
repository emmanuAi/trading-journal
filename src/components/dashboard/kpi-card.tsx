import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "neutral" | "profit" | "loss";
  icon?: React.ReactNode;
}) {
  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div
          className={cn(
            "mt-2 text-xl font-semibold tracking-tight",
            tone === "profit" && "text-profit",
            tone === "loss" && "text-loss",
            tone === "neutral" && "text-foreground"
          )}
        >
          {value}
        </div>
        {sublabel && <div className="mt-1 text-[11px] text-muted-foreground">{sublabel}</div>}
      </CardContent>
    </Card>
  );
}
