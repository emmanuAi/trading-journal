"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2, Pencil, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { useSettings } from "@/lib/hooks";
import { useAccountContext } from "@/components/layout/account-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScreenshotSection } from "@/components/trade-form/screenshot-uploader";
import { TradeForm, tradeToFormValues, tradeFormValuesToInput, type TradeFormValues } from "@/components/trade-form/trade-form";
import type { Trade } from "@/lib/types";
import { formatCurrency, formatR, formatNumber } from "@/lib/utils";
import { holdingDurationHours, calcRealizedPips } from "@/lib/calculations";

export default function TradeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useSettings();
  const { accounts } = useAccountContext();

  const [trade, setTrade] = React.useState<Trade | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [mode, setMode] = React.useState<"view" | "edit">("view");
  const [formValues, setFormValues] = React.useState<TradeFormValues | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const refetch = React.useCallback(async () => {
    const res = await fetch(`/api/trades/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setTrade(data.trade);
      setFormValues(tradeToFormValues(data.trade));
    }
  }, [params.id]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  const account = accounts.find((a) => a.id === trade?.accountId);
  const currency = account?.baseCurrency ?? settings?.baseCurrency ?? "EUR";

  async function handleUpdate() {
    if (!trade || !formValues) return;
    setSubmitting(true);
    const res = await fetch(`/api/trades/${trade.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tradeFormValuesToInput(formValues, trade.accountId, trade.isDemo)),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to update trade.");
      return;
    }
    toast.success("Trade updated.");
    setTrade(data.trade);
    setFormValues(tradeToFormValues(data.trade));
    setMode("view");
  }

  async function handleDuplicate() {
    if (!trade) return;
    const res = await fetch(`/api/trades/${trade.id}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to duplicate trade.");
      return;
    }
    toast.success(`Duplicated as ${data.trade.id}.`);
    router.push(`/journal/${data.trade.id}`);
  }

  async function handleDelete() {
    if (!trade) return;
    const res = await fetch(`/api/trades/${trade.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete trade.");
      return;
    }
    toast.success("Trade deleted.");
    router.push("/journal");
  }

  if (loading || !trade) {
    return (
      <div>
        <Topbar title="Trade Detail" />
        <div className="p-8">
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        </div>
      </div>
    );
  }

  const holdHours = holdingDurationHours(trade.entryTime, trade.exitTime);

  return (
    <div>
      <Topbar title={trade.id} description={`${trade.instrument} · ${trade.direction === "long" ? "Long" : "Short"}`} />
      <div className="p-4 lg:p-8 flex flex-col gap-6">
        <Link href="/journal" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-3 w-3" /> Back to journal
        </Link>

        <Card>
          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={trade.direction === "long" ? "accent" : "outline"}>{trade.direction === "long" ? "LONG" : "SHORT"}</Badge>
              <Badge variant={trade.status === "open" ? "warning" : trade.status === "cancelled" ? "outline" : "default"}>{trade.status}</Badge>
              {trade.result && <Badge variant={trade.result === "win" ? "profit" : trade.result === "loss" ? "loss" : "default"}>{trade.result}</Badge>}
              {trade.setupGrade && <Badge variant="accent">{trade.setupGrade} Setup</Badge>}
              {trade.isDemo && <Badge variant="warning">Demo</Badge>}
              {!trade.followedPlan && <Badge variant="loss">Broke Plan</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant={mode === "view" ? "secondary" : "outline"} size="sm" onClick={() => setMode("view")}>
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
              <Button variant={mode === "edit" ? "secondary" : "outline"} size="sm" onClick={() => setMode("edit")}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        {mode === "edit" && formValues ? (
          <Card>
            <CardContent className="p-6">
              <TradeForm
                values={formValues}
                onChange={setFormValues}
                strategies={settings?.strategies ?? []}
                onSubmit={handleUpdate}
                submitting={submitting}
                submitLabel="Save Changes"
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Realized P&L" value={trade.realizedPnl != null ? formatCurrency(trade.realizedPnl, currency) : "—"} tone={trade.realizedPnl != null ? (trade.realizedPnl >= 0 ? "profit" : "loss") : "neutral"} />
              <Stat label="Planned RR" value={trade.plannedRR != null ? `1:${formatNumber(trade.plannedRR)}` : "—"} />
              <Stat label="Actual R" value={trade.actualR != null ? formatR(trade.actualR) : "—"} tone={trade.actualR != null ? (trade.actualR >= 0 ? "profit" : "loss") : "neutral"} />
              <Stat label="Risk Amount" value={trade.riskAmount != null ? formatCurrency(trade.riskAmount, currency) : "—"} />
              <Stat label="Risk %" value={trade.riskPercent != null ? `${formatNumber(trade.riskPercent)}%` : "—"} />
              <Stat label="Holding Time" value={holdHours != null ? `${formatNumber(holdHours, 1)}h` : "—"} />
            </div>

            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="psychology">Psychology Journal</TabsTrigger>
                <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <Card>
                  <CardContent className="p-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 text-sm">
                    <DetailRow label="Entry Time" value={new Date(trade.entryTime).toLocaleString()} />
                    <DetailRow label="Exit Time" value={trade.exitTime ? new Date(trade.exitTime).toLocaleString() : "—"} />
                    <DetailRow label="Entry Price" value={String(trade.entryPrice)} />
                    <DetailRow label="Exit Price" value={trade.exitPrice != null ? String(trade.exitPrice) : "—"} />
                    <DetailRow
                      label="Realized Pips"
                      value={(() => {
                        const pips = calcRealizedPips(trade);
                        return pips !== null ? `${pips >= 0 ? "+" : ""}${pips.toFixed(1)} pips` : "—";
                      })()}
                    />
                    <DetailRow
                      label="Maximum Drawdown (Pips)"
                      value={trade.maxDrawdownPips != null ? `${trade.maxDrawdownPips.toFixed(1)} pips` : "—"}
                    />
                    <DetailRow label="Stop Loss" value={trade.stopLoss != null ? String(trade.stopLoss) : "—"} />
                    <DetailRow label="Take Profit" value={trade.takeProfit != null ? String(trade.takeProfit) : "—"} />
                    <DetailRow label="Position Size" value={String(trade.positionSize)} />
                    <DetailRow label="Balance at Entry" value={formatCurrency(trade.accountBalanceAtEntry, currency)} />
                    <DetailRow label="Fees" value={formatCurrency(trade.fees, currency)} />
                    <DetailRow label="Commission" value={formatCurrency(trade.commission, currency)} />
                    <DetailRow label="Swap" value={formatCurrency(trade.swap, currency)} />
                    <DetailRow label="Strategy" value={trade.strategy ?? "—"} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="psychology" className="flex flex-col gap-4">
                <JournalCard title="Pre-Trade Analysis">
                  <JournalRow label="Entry reason" value={trade.preTrade.entryReason} />
                  <JournalRow label="Fundamental bias" value={trade.preTrade.fundamentalBias} />
                  <JournalRow label="Technical confirmation" value={trade.preTrade.technicalConfirmation} />
                  <JournalRow label="Thesis" value={trade.preTrade.thesis} />
                  <JournalRow label="Invalidation" value={trade.preTrade.invalidation} />
                </JournalCard>
                <JournalCard title="During the Trade">
                  <JournalRow label="Feelings" value={trade.duringTrade.feelings} />
                  <div className="flex flex-wrap gap-1.5">
                    {trade.duringTrade.emotions.map((e) => (
                      <Badge key={e} variant="accent">
                        {e}
                      </Badge>
                    ))}
                  </div>
                  <JournalRow label="Moved stop-loss" value={trade.duringTrade.movedStopLoss ? "Yes" : "No"} />
                </JournalCard>
                <JournalCard title="Post-Trade Review">
                  <JournalRow label="What went well" value={trade.postTrade.wentWell} />
                  <JournalRow label="What went wrong" value={trade.postTrade.wentWrong} />
                  <JournalRow label="Lesson learned" value={trade.postTrade.lessonLearned} />
                  <JournalRow label="Would repeat" value={trade.postTrade.wouldRepeat === null ? "—" : trade.postTrade.wouldRepeat ? "Yes" : "No"} />
                  <JournalRow label="Improvement" value={trade.postTrade.improvement} />
                </JournalCard>
              </TabsContent>

              <TabsContent value="screenshots">
                <Card>
                  <CardContent className="p-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <ScreenshotSection tradeId={trade.id} phase="before" label="Before Entry" screenshots={trade.screenshots.filter((s) => s.phase === "before")} onChange={refetch} />
                    <ScreenshotSection tradeId={trade.id} phase="during" label="During Trade" screenshots={trade.screenshots.filter((s) => s.phase === "during")} onChange={refetch} />
                    <ScreenshotSection tradeId={trade.id} phase="after" label="After Exit" screenshots={trade.screenshots.filter((s) => s.phase === "after")} onChange={refetch} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this trade?</DialogTitle>
            <DialogDescription>
              This permanently deletes {trade.id} and all of its screenshots. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "profit" | "loss" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`mt-1 text-sm font-semibold ${tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function JournalCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

function JournalRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}
