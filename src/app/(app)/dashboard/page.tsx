"use client";
import * as React from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  Flame,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useTrades, useSettings } from "@/lib/hooks";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EquityCurveChart, type EquityMode } from "@/components/dashboard/equity-curve-chart";
import { TimeRangePicker, type DateRange } from "@/components/dashboard/time-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  winRateStats,
  averageWin,
  averageLoss,
  averagePlannedRR,
  averageActualR,
  profitFactor,
  totalR,
  largestWin,
  largestLoss,
  maxDrawdownPercent,
  currentStreak,
  planCompliance,
  netPnl,
  returnPercent,
  buildEquityCurve,
  statsByInstrument,
} from "@/lib/calculations";
import { formatCurrency, formatPercent, formatR, formatNumber } from "@/lib/utils";

export default function DashboardPage() {
  const { accounts, activeAccountId, aggregated } = useAccountContext();
  const { settings } = useSettings();
  const [range, setRange] = React.useState<DateRange>({ key: "all" });
  const [equityMode, setEquityMode] = React.useState<EquityMode>("balance");

  const { trades, loading } = useTrades({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const startingBalance = aggregated
    ? accounts.reduce((s, a) => s + a.startingBalance, 0)
    : activeAccount?.startingBalance ?? 0;
  const currency = aggregated ? "EUR" : activeAccount?.baseCurrency ?? settings?.baseCurrency ?? "EUR";

  const closedTrades = trades.filter((t) => t.status === "closed");
  const openTrades = trades.filter((t) => t.status === "open");
  const demoVisible = trades.some((t) => t.isDemo);

  const win = winRateStats(trades);
  const avgWin = averageWin(trades);
  const avgLoss = averageLoss(trades);
  const avgRR = averagePlannedRR(trades);
  const avgR = averageActualR(trades);
  const pf = profitFactor(trades);
  const rTotal = totalR(trades);
  const biggestWin = largestWin(trades);
  const biggestLoss = largestLoss(trades);
  const drawdown = maxDrawdownPercent(trades, startingBalance);
  const streak = currentStreak(trades);
  const compliance = planCompliance(trades);
  const pnl = netPnl(trades);
  const retPct = returnPercent(trades, startingBalance);
  const equityPoints = buildEquityCurve(trades, startingBalance);
  const currentBalance = startingBalance + pnl;
  const topPairs = statsByInstrument(trades)
    .sort((a, b) => b.netPnl - a.netPnl)
    .slice(0, 5);

  const pfLabel = pf === null ? "—" : pf === Infinity ? "∞" : formatNumber(pf);

  return (
    <div>
      <Topbar title="Dashboard" description="Live performance across your closed trades." />
      <div className="p-4 lg:p-8 flex flex-col gap-6">
        {demoVisible && (
          <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" /> You&apos;re viewing demo data mixed with any real trades you&apos;ve logged. Turn it off anytime in Settings.
            </span>
            <Link href="/settings" className="underline font-medium">
              Go to Settings
            </Link>
          </div>
        )}

        {!loading && trades.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No trades yet for this account.</p>
              <Button asChild>
                <Link href="/trades/new">Log your first trade</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Total Trades" value={String(closedTrades.length)} sublabel={`${openTrades.length} open`} icon={<Target className="h-4 w-4" />} />
          <KpiCard
            label="Net P&L"
            value={formatCurrency(pnl, currency)}
            sublabel={retPct !== null ? formatPercent(retPct) : "—"}
            tone={pnl > 0 ? "profit" : pnl < 0 ? "loss" : "neutral"}
            icon={pnl >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          />
          <KpiCard label="Account Balance" value={formatCurrency(currentBalance, currency)} sublabel={`Start: ${formatCurrency(startingBalance, currency)}`} icon={<Wallet className="h-4 w-4" />} />
          <KpiCard
            label="Win Rate"
            value={win.winRate !== null ? formatPercent(win.winRate, 1) : "—"}
            sublabel={`${win.wins}W / ${win.losses}L / ${win.breakevens}BE`}
            tone={win.winRate !== null && win.winRate >= 50 ? "profit" : "neutral"}
            icon={<Percent className="h-4 w-4" />}
          />
          <KpiCard
            label="Profit Factor"
            value={pfLabel}
            tone={pf !== null && pf >= 1 ? "profit" : pf !== null ? "loss" : "neutral"}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <KpiCard label="Avg Win" value={avgWin !== null ? formatCurrency(avgWin, currency) : "—"} tone="profit" icon={<TrendingUp className="h-4 w-4" />} />
          <KpiCard label="Avg Loss" value={avgLoss !== null ? formatCurrency(avgLoss, currency) : "—"} tone="loss" icon={<TrendingDown className="h-4 w-4" />} />
          <KpiCard label="Avg Planned RR" value={avgRR !== null ? `1:${formatNumber(avgRR)}` : "—"} />
          <KpiCard label="Avg Realized R" value={avgR !== null ? formatR(avgR) : "—"} tone={avgR !== null && avgR >= 0 ? "profit" : "loss"} />
          <KpiCard label="Total R" value={rTotal !== null ? formatR(rTotal) : "—"} tone={rTotal !== null && rTotal >= 0 ? "profit" : "loss"} />
          <KpiCard label="Largest Win" value={biggestWin !== null ? formatCurrency(biggestWin, currency) : "—"} tone="profit" />
          <KpiCard label="Largest Loss" value={biggestLoss !== null ? formatCurrency(biggestLoss, currency) : "—"} tone="loss" />
          <KpiCard label="Max Drawdown" value={formatPercent(drawdown, 1)} tone={drawdown > 0 ? "loss" : "neutral"} />
          <KpiCard
            label={streak.type === "win" ? "Winning Streak" : streak.type === "loss" ? "Losing Streak" : "Streak"}
            value={streak.count > 0 ? `${streak.count} ${streak.type === "win" ? "W" : "L"}` : "—"}
            tone={streak.type === "win" ? "profit" : streak.type === "loss" ? "loss" : "neutral"}
            icon={<Flame className="h-4 w-4" />}
          />
          <KpiCard label="Plan Compliance" value={compliance !== null ? formatPercent(compliance, 0) : "—"} tone={compliance !== null && compliance >= 80 ? "profit" : "neutral"} />
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-foreground text-base font-semibold">Realized Equity Curve</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Only closed trades move this curve — open positions are tracked separately.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                <button
                  onClick={() => setEquityMode("balance")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${equityMode === "balance" ? "bg-accent/15 text-accent" : "text-muted-foreground"}`}
                >
                  {currency}
                </button>
                <button
                  onClick={() => setEquityMode("r")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${equityMode === "r" ? "bg-accent/15 text-accent" : "text-muted-foreground"}`}
                >
                  R
                </button>
              </div>
              <TimeRangePicker value={range} onChange={setRange} />
            </div>
          </CardHeader>
          <CardContent>
            <EquityCurveChart points={equityPoints} startingBalance={startingBalance} currency={currency} mode={equityMode} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {trades.slice(0, 6).map((t) => (
                <Link
                  key={t.id}
                  href={`/journal/${t.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={t.direction === "long" ? "accent" : "outline"}>{t.direction === "long" ? "LONG" : "SHORT"}</Badge>
                    <span className="text-sm font-medium">{t.instrument}</span>
                    <span className="text-xs text-muted-foreground">{new Date(t.exitTime ?? t.entryTime).toLocaleDateString()}</span>
                  </div>
                  <span className={`text-sm font-semibold ${t.realizedPnl != null && t.realizedPnl >= 0 ? "text-profit" : "text-loss"}`}>
                    {t.realizedPnl != null ? formatCurrency(t.realizedPnl, currency) : "Open"}
                  </span>
                </Link>
              ))}
              {trades.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No trades yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Most Profitable Pairs</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {topPairs.map((p) => (
                <div key={p.key} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.key}</span>
                  <span className={`text-sm font-semibold ${p.netPnl >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(p.netPnl, currency)}</span>
                </div>
              ))}
              {topPairs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No data yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
