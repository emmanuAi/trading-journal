"use client";
import * as React from "react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useTrades, useSettings } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarStatChart } from "@/components/analytics/bar-stat-chart";
import { RDistributionChart } from "@/components/analytics/r-distribution-chart";
import { DrawdownChart } from "@/components/analytics/drawdown-chart";
import { CalendarHeatmap } from "@/components/analytics/calendar-heatmap";
import { EquityCurveChart } from "@/components/dashboard/equity-curve-chart";
import {
  winRateStats,
  statsByInstrument,
  statsByStrategy,
  statsByMonth,
  statsByDayOfWeek,
  statsByDirection,
  statsByEmotion,
  statsByPlanCompliance,
  expectancyR,
  averageActualR,
  averageHoldingDurationHours,
  buildEquityCurve,
  buildDrawdownSeries,
  calendarDailyPnl,
  returnPercent,
  netPnl,
  pipStatistics,
} from "@/lib/calculations";
import { formatCurrency, formatPercent, formatR, formatNumber } from "@/lib/utils";

function formatPips(v: number | null, digits = 1) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)} pips`;
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AnalyticsPage() {
  const { accounts, activeAccountId } = useAccountContext();
  const { settings } = useSettings();
  const account = accounts.find((a) => a.id === activeAccountId);
  const currency = account?.baseCurrency ?? settings?.baseCurrency ?? "EUR";
  const startingBalance = account?.startingBalance ?? 10000;

  const { trades, loading } = useTrades({});

  const win = winRateStats(trades);
  const byMonth = statsByMonth(trades).sort((a, b) => a.key.localeCompare(b.key));
  const byDay = DAY_ORDER.map((d) => statsByDayOfWeek(trades).find((s) => s.key === d) ?? { key: d, trades: 0, winRate: null, netPnl: 0, profitFactor: null, avgR: null });
  const byDirection = statsByDirection(trades);
  const byInstrument = statsByInstrument(trades).sort((a, b) => b.trades - a.trades).slice(0, 10);
  const byStrategy = statsByStrategy(trades);
  const byEmotion = statsByEmotion(trades);
  const byPlan = statsByPlanCompliance(trades);
  const expectancy = expectancyR(trades);
  const avgR = averageActualR(trades);
  const avgHoldHours = averageHoldingDurationHours(trades);
  const equityPoints = buildEquityCurve(trades, startingBalance);
  const drawdownPoints = buildDrawdownSeries(trades, startingBalance);
  const dailyPnl = calendarDailyPnl(trades);
  const retPct = returnPercent(trades, startingBalance);
  const pnl = netPnl(trades);
  const pips = pipStatistics(trades);

  const monthlyLabel = (key: string) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  };

  if (loading) {
    return (
      <div>
        <Topbar title="Analytics" />
        <div className="p-8">
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Analytics" description="Deep performance breakdowns, recalculated live from your trades." />
      <div className="p-4 lg:p-8 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Overall Win Rate" value={win.winRate != null ? formatPercent(win.winRate, 1) : "—"} />
          <KpiCard label="Expectancy (R)" value={expectancy != null ? formatR(expectancy) : "—"} tone={expectancy != null ? (expectancy >= 0 ? "profit" : "loss") : "neutral"} />
          <KpiCard label="Avg R / Trade" value={avgR != null ? formatR(avgR) : "—"} />
          <KpiCard label="Monthly Net Profit (avg)" value={byMonth.length ? formatCurrency(byMonth.reduce((s, m) => s + m.netPnl, 0) / byMonth.length, currency) : "—"} />
          <KpiCard label="Avg Holding Duration" value={avgHoldHours != null ? `${formatNumber(avgHoldHours, 1)}h` : "—"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Win Rate Trend by Month</CardTitle>
            </CardHeader>
            <CardContent>
              <BarStatChart data={byMonth.map((m) => ({ ...m, key: monthlyLabel(m.key) }))} metric="winRate" colorBySign={false} valueFormatter={(v) => formatPercent(v, 1)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Monthly Net P&L</CardTitle>
              <p className="text-xs text-muted-foreground">Total: {formatCurrency(pnl, currency)} ({retPct != null ? formatPercent(retPct) : "—"})</p>
            </CardHeader>
            <CardContent>
              <BarStatChart data={byMonth.map((m) => ({ ...m, key: monthlyLabel(m.key) }))} metric="netPnl" valueFormatter={(v) => formatCurrency(v, currency)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Profit by Instrument</CardTitle>
            </CardHeader>
            <CardContent>
              <BarStatChart data={byInstrument} metric="netPnl" valueFormatter={(v) => formatCurrency(v, currency)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">R-Multiple Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <RDistributionChart trades={trades} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Win Rate by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <BarStatChart data={byDay} metric="winRate" colorBySign={false} valueFormatter={(v) => formatPercent(v, 1)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">Long vs Short Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <BarStatChart data={byDirection} metric="winRate" colorBySign={false} valueFormatter={(v) => formatPercent(v, 1)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityCurveChart points={equityPoints} startingBalance={startingBalance} currency={currency} mode="balance" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DrawdownChart points={drawdownPoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Pip Statistics</CardTitle>
            <p className="text-xs text-muted-foreground">
              Realized pips, normalized per instrument&apos;s own pip size — separate from monetary P&amp;L.
              {pips.tradesMissingPips > 0 &&
                ` ${pips.tradesMissingPips} closed trade${pips.tradesMissingPips === 1 ? "" : "s"} excluded (instrument has no known pip size).`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard
                label="Total Net Pips"
                value={formatPips(pips.totalNetPips)}
                tone={pips.totalNetPips === null ? "neutral" : pips.totalNetPips >= 0 ? "profit" : "loss"}
              />
              <KpiCard
                label="Avg Pips / Trade"
                value={formatPips(pips.avgPipsPerTrade)}
                tone={pips.avgPipsPerTrade === null ? "neutral" : pips.avgPipsPerTrade >= 0 ? "profit" : "loss"}
              />
              <KpiCard label="Avg Winning Trade" value={formatPips(pips.avgWinningPips)} tone={pips.avgWinningPips === null ? "neutral" : "profit"} />
              <KpiCard label="Avg Losing Trade" value={formatPips(pips.avgLosingPips)} tone={pips.avgLosingPips === null ? "neutral" : "loss"} />
              <KpiCard label="Avg Max Drawdown" value={pips.avgMaxDrawdownPips !== null ? `${pips.avgMaxDrawdownPips.toFixed(1)} pips` : "No data yet"} />
              <KpiCard label="Largest Max Drawdown" value={pips.largestMaxDrawdownPips !== null ? `${pips.largestMaxDrawdownPips.toFixed(1)} pips` : "No data yet"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Calendar Heatmap</CardTitle>
            <p className="text-xs text-muted-foreground">Last ~18 weeks of realized daily P&L.</p>
          </CardHeader>
          <CardContent>
            <CalendarHeatmap days={dailyPnl} currency={currency} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatTable title="Win Rate &amp; Profit Factor by Strategy" rows={byStrategy} currency={currency} />
          <StatTable title="Performance by Emotion" rows={byEmotion} currency={currency} />
          <StatTable title="Plan Compliance vs Performance" rows={byPlan} currency={currency} />
        </div>
      </div>
    </div>
  );
}

function StatTable({ title, rows, currency }: { title: string; rows: ReturnType<typeof statsByStrategy>; currency: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between text-sm">
            <span className="font-medium">{r.key}</span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{r.trades} trades</span>
              <span>{r.winRate != null ? formatPercent(r.winRate, 0) : "—"} WR</span>
              <span className={r.netPnl >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(r.netPnl, currency)}</span>
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>}
      </CardContent>
    </Card>
  );
}
