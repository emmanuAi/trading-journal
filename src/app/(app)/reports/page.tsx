"use client";
import * as React from "react";
import useSWR from "swr";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useSettings } from "@/lib/hooks";
import { fetcher } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn, formatCurrency, formatPercent, formatR } from "@/lib/utils";
import { getLocalWeekWindow } from "@/lib/ai/weekly-snapshot";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { WeeklyReportSummary, ReportInterpretation } from "@/lib/ai/types";

interface BudgetStatus {
  status: "ok" | "warning" | "exhausted";
  percentUsed: number;
  warning: boolean;
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00.000Z`);
  const end = new Date(`${weekEnd}T12:00:00.000Z`);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function parseInterpretation(summaryText: string): { empty: true; message: string } | { empty: false; data: ReportInterpretation } | null {
  try {
    const parsed = JSON.parse(summaryText);
    if (parsed && parsed.empty === true) return { empty: true, message: parsed.message ?? "No trades were recorded for this week." };
    if (parsed && Array.isArray(parsed.strengths) && Array.isArray(parsed.actionItems)) {
      return { empty: false, data: parsed as ReportInterpretation };
    }
    return null;
  } catch {
    return null;
  }
}

export default function ReportsPage() {
  const { accounts, activeAccountId, aggregated, loading: accountsLoading } = useAccountContext();
  const { settings } = useSettings();
  const { data: budget } = useSWR<BudgetStatus>("/api/coach/budget-status", fetcher, { refreshInterval: 60_000 });
  const { data: reportsData, mutate: mutateReports } = useSWR<{ reports: WeeklyReportSummary[] }>("/api/coach/reports", fetcher, {
    revalidateOnFocus: false,
  });
  const reports = reportsData?.reports ?? [];

  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const [generating, setGenerating] = React.useState(false);
  const [regenerateOpen, setRegenerateOpen] = React.useState(false);

  const timezone = settings?.timezone ?? "UTC";
  // Named weekWindow, not `window` — this is a client component and `window`
  // is the browser global; shadowing it here would be a silent footgun.
  const weekWindow = React.useMemo(() => getLocalWeekWindow(referenceDate, timezone, 0), [referenceDate, timezone]);
  const currentWeek = React.useMemo(() => getLocalWeekWindow(new Date(), timezone, 0), [timezone]);
  const isCurrentWeek = weekWindow.weekStart === currentWeek.weekStart;
  const isFutureWeek = weekWindow.weekStart > currentWeek.weekStart;

  const scopedAccountId = aggregated ? null : activeAccountId;
  const selectedReport = reports.find((r) => r.weekStart === weekWindow.weekStart && r.accountId === scopedAccountId);
  const history = reports.filter((r) => r.accountId === scopedAccountId);

  const budgetExhausted = budget?.status === "exhausted";
  const canGenerate = !accountsLoading && !isFutureWeek && !generating && !budgetExhausted && accounts.length > 0;

  async function generate(regenerate: boolean) {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/coach/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekWindow.weekStart, accountId: scopedAccountId, aggregated, regenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't generate that report.");
        return;
      }
      await mutateReports();
      toast.success(data.cached ? "Showing the existing report for this week." : regenerate ? "Report regenerated." : "Report generated.");
    } catch {
      toast.error("Network error generating that report.");
    } finally {
      setGenerating(false);
      setRegenerateOpen(false);
    }
  }

  const interpretation = selectedReport ? parseInterpretation(selectedReport.summaryText) : null;
  const stats = selectedReport?.statsSnapshot.stats;
  const pips = selectedReport?.statsSnapshot.pips;

  return (
    <div className="flex flex-col h-screen">
      <Topbar title="Weekly Reports" description="On-demand AI analysis of your trading week" />

      <div className="flex-1 flex px-4 py-4 lg:px-8 gap-4 overflow-hidden">
        <Card className="hidden md:flex w-64 shrink-0 flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground px-1">Report history</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col p-2 gap-0.5">
              {history.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">No reports generated yet.</p>}
              {history.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReferenceDate(new Date(`${r.weekStart}T12:00:00.000Z`))}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    r.weekStart === weekWindow.weekStart ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  )}
                >
                  {r.source === "scheduled" ? (
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate">{formatWeekLabel(r.weekStart, r.weekEnd)}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
          {budget && budget.status !== "ok" && (
            <Card className={cn("border-l-2", budget.status === "exhausted" ? "border-l-loss" : "border-l-warning")}>
              <CardContent className="flex items-center gap-2 py-3 text-sm">
                <AlertTriangle className={cn("h-4 w-4 shrink-0", budget.status === "exhausted" ? "text-loss" : "text-warning")} />
                {budget.status === "exhausted"
                  ? "This month's AI coach budget has been reached. Report generation will be available again next month."
                  : `This month's AI coach budget is at ${budget.percentUsed}% — generation may pause once the limit is reached.`}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setReferenceDate(new Date(referenceDate.getTime() - 7 * 86400000))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[180px] text-center">
                  <div className="text-sm font-semibold text-foreground">{formatWeekLabel(weekWindow.weekStart, weekWindow.weekEnd)}</div>
                  {isCurrentWeek && <div className="text-[11px] text-muted-foreground">Current week (in progress)</div>}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isCurrentWeek}
                  onClick={() => setReferenceDate(new Date(referenceDate.getTime() + 7 * 86400000))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {!selectedReport ? (
                  <Button onClick={() => generate(false)} disabled={!canGenerate}>
                    <Sparkles className="h-4 w-4" />
                    {generating ? "Generating…" : "Generate Report"}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setRegenerateOpen(true)} disabled={!canGenerate}>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {!selectedReport && !generating && (
            <Card className="flex-1">
              <CardContent className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/50 shadow-[0_0_20px_-4px_var(--accent)]">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <p className="text-sm font-medium text-foreground">No report yet for this week</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {isFutureWeek
                    ? "This week hasn't started yet."
                    : "Generate a report to get a deterministic stats breakdown plus an AI-written summary of strengths, weaknesses, and next steps."}
                </p>
              </CardContent>
            </Card>
          )}

          {generating && !selectedReport && (
            <Card>
              <CardContent className="py-10 flex flex-col items-center gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          )}

          {selectedReport && (
            <>
              {selectedReport.tradesCount === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-2 text-center py-16">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">No trades this week</p>
                    <p className="text-xs text-muted-foreground">No AI analysis was generated — there was nothing to analyze.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <KpiCard
                      label="Net P&L"
                      value={formatCurrency(stats!.netPnl, selectedReport.statsSnapshot.currency)}
                      tone={stats!.netPnl >= 0 ? "profit" : "loss"}
                      icon={stats!.netPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    />
                    <KpiCard
                      label="Win Rate"
                      value={stats!.winRate != null ? formatPercent(stats!.winRate, 1) : "—"}
                      sublabel={`${stats!.wins}W / ${stats!.losses}L / ${stats!.breakevens}BE`}
                      icon={<Target className="h-4 w-4" />}
                    />
                    <KpiCard
                      label="Profit Factor"
                      value={stats!.profitFactor != null ? (stats!.profitFactor === Infinity ? "∞" : formatR(stats!.profitFactor)) : "—"}
                      icon={<Percent className="h-4 w-4" />}
                    />
                    <KpiCard label="Avg Actual R" value={formatR(stats!.avgActualR)} icon={<TrendingUp className="h-4 w-4" />} />
                    <KpiCard
                      label="Max Drawdown"
                      value={formatPercent(stats!.maxDrawdownPercent, 1)}
                      tone={stats!.maxDrawdownPercent > 0 ? "loss" : "neutral"}
                      icon={<TrendingDown className="h-4 w-4" />}
                    />
                    <KpiCard
                      label="Plan Compliance"
                      value={stats!.planCompliancePercent != null ? formatPercent(stats!.planCompliancePercent, 0) : "—"}
                      icon={<ShieldCheck className="h-4 w-4" />}
                    />
                  </div>

                  {pips && pips.tradesWithPips > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Pip Statistics</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Net Pips</div>
                          <div className="font-medium">{pips.totalNetPips != null ? formatR(pips.totalNetPips, 1) : "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Avg / Trade</div>
                          <div className="font-medium">{pips.avgPipsPerTrade != null ? formatR(pips.avgPipsPerTrade, 1) : "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Avg Winning Pips</div>
                          <div className="font-medium">{pips.avgWinningPips != null ? formatR(pips.avgWinningPips, 1) : "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Avg Losing Pips</div>
                          <div className="font-medium">{pips.avgLosingPips != null ? formatR(pips.avgLosingPips, 1) : "—"}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {stats!.streak.type !== "none" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                      <Flame className="h-4 w-4 text-accent" />
                      Current streak: <span className="font-medium text-foreground">{stats!.streak.count} {stats!.streak.type}{stats!.streak.count === 1 ? "" : "s"}</span> in a row
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <CardTitle>AI Coach Interpretation</CardTitle>
                        <Badge variant={selectedReport.source === "scheduled" ? "accent" : "outline"}>
                          {selectedReport.source === "scheduled" ? "Automated" : "Manual"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Generated by {selectedReport.modelUsed === "none" ? "—" : selectedReport.modelUsed} · based only on the stats above and your own journal notes
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {interpretation === null ? (
                        <p className="text-sm text-muted-foreground">This report&apos;s AI summary couldn&apos;t be displayed.</p>
                      ) : interpretation.empty ? (
                        <p className="text-sm text-muted-foreground">{interpretation.message}</p>
                      ) : (
                        <>
                          <p className="text-sm text-foreground">{interpretation.data.overview}</p>

                          {interpretation.data.strengths.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-profit uppercase tracking-wide mb-1.5">Strengths</h4>
                              <ul className="space-y-1 text-sm text-foreground list-disc list-inside">
                                {interpretation.data.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {interpretation.data.weaknesses.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-loss uppercase tracking-wide mb-1.5">Weaknesses</h4>
                              <ul className="space-y-1 text-sm text-foreground list-disc list-inside">
                                {interpretation.data.weaknesses.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {interpretation.data.patterns.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">Patterns</h4>
                              <ul className="space-y-1 text-sm text-foreground list-disc list-inside">
                                {interpretation.data.patterns.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div>
                            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Three Action Items</h4>
                            <div className="space-y-2">
                              {interpretation.data.actionItems.map((a, i) => (
                                <div key={i} className="rounded-lg border border-border bg-surface-2 p-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="accent">{i + 1}</Badge>
                                    <span className="text-sm font-medium text-foreground">{a.title}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg bg-surface-2 p-3">
                            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Evidence vs. Hypothesis</h4>
                            <p className="text-xs text-muted-foreground">{interpretation.data.evidenceNote}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate this report?</DialogTitle>
            <DialogDescription>
              This makes a new AI request for {formatWeekLabel(weekWindow.weekStart, weekWindow.weekEnd)} and counts against this month&apos;s
              shared $5 AI budget, same as a chat message. The current report will be replaced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => generate(true)} disabled={generating}>
              {generating ? "Regenerating…" : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
