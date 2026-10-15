"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useTrades, useSettings } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calendarDailyPnl } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";
import type { Trade } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { accounts, activeAccountId } = useAccountContext();
  const { settings } = useSettings();
  const account = accounts.find((a) => a.id === activeAccountId);
  const currency = account?.baseCurrency ?? settings?.baseCurrency ?? "EUR";

  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  const { trades } = useTrades({
    dateFrom: monthStart.toISOString(),
    dateTo: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59).toISOString(),
  });

  const dailyPnl = calendarDailyPnl(trades);

  const monthlyNet = Array.from(dailyPnl.values()).reduce((s, d) => s + d.netPnl, 0);
  const monthlyTrades = Array.from(dailyPnl.values()).reduce((s, d) => s + d.trades, 0);
  const winningDays = Array.from(dailyPnl.values()).filter((d) => d.netPnl > 0).length;
  const losingDays = Array.from(dailyPnl.values()).filter((d) => d.netPnl < 0).length;

  const firstDayOffset = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [...Array(firstDayOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedTrades: Trade[] = selectedDate ? trades.filter((t) => (t.exitTime ?? t.entryTime).slice(0, 10) === selectedDate) : [];

  return (
    <div>
      <Topbar title="Trading Calendar" description="Realized P&L by day." />
      <div className="p-4 lg:p-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="w-40 text-center text-base font-semibold">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Month P&L: <span className={monthlyNet >= 0 ? "text-profit font-semibold" : "text-loss font-semibold"}>{formatCurrency(monthlyNet, currency)}</span>
            </span>
            <span className="text-muted-foreground">{monthlyTrades} trades</span>
            <span className="text-profit">{winningDays} green days</span>
            <span className="text-loss">{losingDays} red days</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((date, i) => {
                if (!date) return <div key={i} />;
                const key = date.toISOString().slice(0, 10);
                const day = dailyPnl.get(key);
                const isToday = key === new Date().toISOString().slice(0, 10);
                return (
                  <button
                    key={i}
                    onClick={() => day && setSelectedDate(key)}
                    className={`flex h-20 flex-col items-start rounded-lg border p-2 text-left transition-colors ${
                      day
                        ? day.netPnl > 0
                          ? "border-profit/30 bg-profit/10 hover:bg-profit/15"
                          : day.netPnl < 0
                          ? "border-loss/30 bg-loss/10 hover:bg-loss/15"
                          : "border-border bg-surface-2 hover:bg-surface-2/70"
                        : "border-border/50 bg-surface-2/20"
                    } ${isToday ? "ring-1 ring-accent" : ""}`}
                  >
                    <span className="text-xs text-muted-foreground">{date.getDate()}</span>
                    {day && (
                      <>
                        <span className={`mt-1 text-xs font-semibold ${day.netPnl >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(day.netPnl, currency)}</span>
                        <span className="text-[10px] text-muted-foreground">{day.trades} trade{day.trades > 1 ? "s" : ""}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {selectedTrades.map((t) => (
              <Link key={t.id} href={`/journal/${t.id}`} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-2">
                <span className="flex items-center gap-2 text-sm">
                  <Badge variant={t.direction === "long" ? "accent" : "outline"}>{t.direction}</Badge>
                  {t.instrument}
                </span>
                <span className={`text-sm font-semibold ${t.realizedPnl != null && t.realizedPnl >= 0 ? "text-profit" : "text-loss"}`}>
                  {t.realizedPnl != null ? formatCurrency(t.realizedPnl, currency) : "—"}
                </span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
