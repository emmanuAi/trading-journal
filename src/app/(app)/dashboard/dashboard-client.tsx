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
  Info,
  LineChart,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useTrades, useSettings } from "@/lib/hooks";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EquityCurveChart, type EquityMode } from "@/components/dashboard/equity-curve-chart";
import { TimeRangePicker, type DateRange } from "@/components/dashboard/time-range-picker";
import { TradeOutcomesDonut } from "@/components/dashboard/trade-outcomes-donut";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TradesTable } from "@/components/journal/trades-table";
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
  calendarDailyPnl,
} from "@/lib/calculations";
import { formatCurrency, formatPercent, formatR, formatNumber } from "@/lib/utils";

function withSign(n: number, digits = 1) {
  return `${n >= 0 ? "+" : ""}${formatPercent(n, digits)}`;
}

/** Computed from the *browser's* local clock on purpose, not the server's —
 * the server may run in a different timezone than the signed-in user. */
function useTimeOfDayGreeting() {
  const [greeting, setGreeting] = React.useState("Welcome");
  React.useEffect(() => {
    const hour = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberately deferred: the server's clock may be in a different timezone than the browser, so this can only be computed client-side after mount, not during SSR.
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return greeting;
}

export function DashboardClient({ firstName, hasName }: { firstName: string; hasName: boolean }) {
  const { accounts, activeAccountId, aggregated } = useAccountContext();
  const { settings } = useSettings();
  const [range, setRange] = React.useState<DateRange>({ key: "all" });
  const [equityMode, setEquityMode] = React.useState<EquityMode>("balance");
  const greeting = useTimeOfDayGreeting();

  const { trades, loading } = useTrades({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const startingBalance = aggregated
    ? accounts.reduce((s, a) => s + a.startingBalance, 0)
    : activeAccount?.startingBalance ?? 0;
  const currency = aggregated ? "EUR" : activeAccount?.baseCurrency ?? settings?.baseCurrency ?? "EUR";

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
  const totalPairTrades = topPairs.reduce((s, p) => s + p.trades, 0) || 1;
  const calendarDays = calendarDailyPnl(trades);

  const now = new Date();
  const tradesThisMonth = trades.filter((t) => {
    const d = new Date(t.entryTime);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const balanceSeries = equityPoints.map((p) => p.balance);

  const pfLabel = pf === null ? "—" : pf === Infinity ? "∞" : formatNumber(pf);

  if (loading) {
    return (
      <div>
        <Topbar title="Dashboard" description="Live performance across your closed trades." />
        <div className="p-4 lg:p-8 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
          <Skeleton className="h-[340px]" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-[260px] lg:col-span-2" />
            <Skeleton className="h-[260px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Dashboard" description="Live performance across your closed trades." />
      <div className="p-4 lg:p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting}, <span style={{ color: "#FF253E" }}>{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Track. Learn. Improve. Become Consistent.</p>
        </div>

        {!hasName && (
          <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" /> Add your name to personalize your dashboard.
            </span>
            <Link href="/settings#profile" className="underline font-medium">
              Complete profile
            </Link>
          </div>
        )}

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

        {trades.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No trades yet for this account.</p>
              <Button asChild>
                <Link href="/trades/new">Log your first trade</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Primary KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Total P&L"
            value={formatCurrency(pnl, currency)}
            tone={pnl > 0 ? "profit" : pnl < 0 ? "loss" : "neutral"}
            icon={<LineChart className="h-4 w-4" />}
            delta={retPct !== null ? withSign(retPct) : undefined}
            sparkline={balanceSeries}
          />
          <KpiCard
            label="Win Rate"
            value={win.winRate !== null ? formatPercent(win.winRate, 1) : "—"}
            sublabel={`${win.wins}W / ${win.losses}L / ${win.breakevens}BE`}
            icon={<Target className="h-4 w-4" />}
          />
          <KpiCard
            label="Total Trades"
            value={String(trades.length)}
            sublabel={`${openTrades.length} open · +${tradesThisMonth} this month`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <KpiCard
            label="Account Balance"
            value={formatCurrency(currentBalance, currency)}
            sublabel={`Start: ${formatCurrency(startingBalance, currency)}`}
            icon={<Wallet className="h-4 w-4" />}
            sparkline={balanceSeries}
          />
        </div>

        {/* Performance chart + mini calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-foreground text-base font-semibold">Performance</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Only closed trades move this curve — open positions are tracked separately.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
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

          <Card>
            <CardContent className="p-5">
              <MiniCalendar days={calendarDays} currency={currency} />
            </CardContent>
          </Card>
        </div>

        {/* Top pairs, trade outcomes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Most Profitable Pairs</CardTitle>
              <p className="text-xs text-muted-foreground">Bar width shows each pair&apos;s share of your trades.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {topPairs.map((p) => (
                <div key={p.key} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm font-medium text-foreground">{p.key}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(p.trades / totalPairTrades) * 100}%` }} />
                  </div>
                  <span className={`w-20 shrink-0 text-right text-xs font-semibold ${p.netPnl >= 0 ? "text-profit" : "text-loss"}`}>
                    {formatCurrency(p.netPnl, currency)}
                  </span>
                </div>
              ))}
              {topPairs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No data yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Trade Outcomes</CardTitle>
            </CardHeader>
            <CardContent>
              <TradeOutcomesDonut wins={win.wins} losses={win.losses} breakevens={win.breakevens} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-foreground text-base font-semibold">Recent Trades</CardTitle>
            <Link href="/journal" className="text-xs font-medium text-accent hover:underline">
              View All →
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No trades yet.</p>
            ) : (
              <TradesTable trades={trades.slice(0, 6)} currency={currency} />
            )}
          </CardContent>
        </Card>

        {/* Secondary / detailed KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <KpiCard label="Plan Compliance" value={compliance !== null ? formatPercent(compliance, 0) : "—"} tone={compliance !== null && compliance >= 80 ? "profit" : "neutral"} icon={<Percent className="h-4 w-4" />} />
        </div>
      </div>
    </div>
  );
}
