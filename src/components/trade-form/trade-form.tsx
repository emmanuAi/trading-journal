"use client";
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { EmotionTagPicker } from "./emotion-tag-picker";
import { INSTRUMENTS } from "@/lib/instruments";
import { calcPlannedRR, calcGrossPnl, calcNetPnl, calcRiskAmount, calcActualR, determineResult } from "@/lib/calculations";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import type { Direction, SetupGrade, Trade, TradeStatus } from "@/lib/types";

export interface TradeFormValues {
  instrument: string;
  direction: Direction;
  entryTime: string;
  exitTime: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  exitPrice: string;
  positionSize: string;
  accountBalanceAtEntry: string;
  riskPercent: string;
  riskAmount: string;
  fees: string;
  commission: string;
  swap: string;
  status: TradeStatus;
  realizedPnl: string;
  plannedRR: string;
  actualR: string;
  strategy: string;
  setupGrade: SetupGrade;
  followedPlan: boolean;
  emotionTags: string[];
  customTags: string[];
  preTrade: { entryReason: string; fundamentalBias: string; technicalConfirmation: string; thesis: string; invalidation: string };
  duringTrade: { feelings: string; followedPlan: boolean; movedStopLoss: boolean; emotions: string[] };
  postTrade: { wentWell: string; wentWrong: string; lessonLearned: string; wouldRepeat: boolean | null; improvement: string };
}

const instrumentOptions: ComboboxOption[] = INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.label} (${i.symbol})`, group: i.group }));

function nowLocalInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function defaultTradeFormValues(defaults: { accountBalance: number; riskPercent: number }): TradeFormValues {
  return {
    instrument: "EURUSD",
    direction: "long",
    entryTime: nowLocalInput(),
    exitTime: "",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    exitPrice: "",
    positionSize: "",
    accountBalanceAtEntry: String(defaults.accountBalance),
    riskPercent: String(defaults.riskPercent),
    riskAmount: "",
    fees: "0",
    commission: "0",
    swap: "0",
    status: "open",
    realizedPnl: "",
    plannedRR: "",
    actualR: "",
    strategy: "",
    setupGrade: null,
    followedPlan: true,
    emotionTags: [],
    customTags: [],
    preTrade: { entryReason: "", fundamentalBias: "", technicalConfirmation: "", thesis: "", invalidation: "" },
    duringTrade: { feelings: "", followedPlan: true, movedStopLoss: false, emotions: [] },
    postTrade: { wentWell: "", wentWrong: "", lessonLearned: "", wouldRepeat: null, improvement: "" },
  };
}

export function tradeToFormValues(trade: Trade): TradeFormValues {
  return {
    instrument: trade.instrument,
    direction: trade.direction,
    entryTime: toLocalInput(trade.entryTime),
    exitTime: toLocalInput(trade.exitTime),
    entryPrice: String(trade.entryPrice),
    stopLoss: trade.stopLoss != null ? String(trade.stopLoss) : "",
    takeProfit: trade.takeProfit != null ? String(trade.takeProfit) : "",
    exitPrice: trade.exitPrice != null ? String(trade.exitPrice) : "",
    positionSize: String(trade.positionSize),
    accountBalanceAtEntry: String(trade.accountBalanceAtEntry),
    riskPercent: trade.riskPercent != null ? String(trade.riskPercent) : "",
    riskAmount: trade.riskAmount != null ? String(trade.riskAmount) : "",
    fees: String(trade.fees),
    commission: String(trade.commission),
    swap: String(trade.swap),
    status: trade.status,
    realizedPnl: trade.realizedPnl != null ? String(trade.realizedPnl) : "",
    plannedRR: trade.plannedRR != null ? String(trade.plannedRR) : "",
    actualR: trade.actualR != null ? String(trade.actualR) : "",
    strategy: trade.strategy ?? "",
    setupGrade: trade.setupGrade,
    followedPlan: trade.followedPlan,
    emotionTags: trade.emotionTags,
    customTags: trade.customTags,
    preTrade: trade.preTrade,
    duringTrade: trade.duringTrade,
    postTrade: trade.postTrade,
  };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function tradeFormValuesToInput(values: TradeFormValues, accountId: string, isDemo = false) {
  return {
    accountId,
    isDemo,
    instrument: values.instrument.toUpperCase(),
    direction: values.direction,
    entryTime: new Date(values.entryTime).toISOString(),
    exitTime: values.exitTime ? new Date(values.exitTime).toISOString() : null,
    entryPrice: Number(values.entryPrice),
    stopLoss: num(values.stopLoss),
    takeProfit: num(values.takeProfit),
    exitPrice: num(values.exitPrice),
    positionSize: Number(values.positionSize),
    accountBalanceAtEntry: Number(values.accountBalanceAtEntry),
    riskPercent: num(values.riskPercent),
    riskAmount: num(values.riskAmount),
    fees: num(values.fees) ?? 0,
    commission: num(values.commission) ?? 0,
    swap: num(values.swap) ?? 0,
    status: values.status,
    realizedPnl: num(values.realizedPnl),
    plannedRR: num(values.plannedRR),
    actualR: num(values.actualR),
    strategy: values.strategy || null,
    setupGrade: values.setupGrade,
    followedPlan: values.followedPlan,
    emotionTags: values.duringTrade.emotions,
    customTags: values.customTags,
    preTrade: values.preTrade,
    duringTrade: values.duringTrade,
    postTrade: values.postTrade,
  };
}

export function TradeForm({
  values,
  onChange,
  strategies,
  onSubmit,
  submitting,
  submitLabel = "Save Trade",
  screenshotsPanel,
}: {
  values: TradeFormValues;
  onChange: (values: TradeFormValues) => void;
  strategies: string[];
  onSubmit: () => void;
  submitting: boolean;
  submitLabel?: string;
  /** Optional Screenshots tab content. Omit to keep the form exactly as before (used in edit mode, where screenshots already have their own tab on the detail page). */
  screenshotsPanel?: React.ReactNode;
}) {
  const [dirty, setDirty] = React.useState({ riskAmount: false, plannedRR: false, realizedPnl: false, actualR: false });
  const [checklist, setChecklist] = React.useState({ plan: false, risk: false, emotion: false, screenshot: false });

  const entryPrice = num(values.entryPrice);
  const stopLoss = num(values.stopLoss);
  const takeProfit = num(values.takeProfit);
  const exitPrice = num(values.exitPrice);
  const positionSize = num(values.positionSize) ?? 0;
  const accountBalance = num(values.accountBalanceAtEntry) ?? 0;
  const riskPercent = num(values.riskPercent);
  const fees = num(values.fees) ?? 0;
  const commission = num(values.commission) ?? 0;
  const swap = num(values.swap) ?? 0;

  const computedRR = calcPlannedRR(entryPrice, stopLoss, takeProfit);
  const computedRiskAmount = calcRiskAmount(accountBalance, riskPercent);
  const computedGrossPnl = entryPrice != null && exitPrice != null ? calcGrossPnl(entryPrice, exitPrice, positionSize, values.direction) : null;
  const computedNetPnl = computedGrossPnl != null ? calcNetPnl(computedGrossPnl, fees, commission, swap) : null;
  const effectiveRiskAmount = dirty.riskAmount ? num(values.riskAmount) : computedRiskAmount;
  const computedActualR = calcActualR(computedNetPnl, effectiveRiskAmount);
  const computedResult = determineResult(computedNetPnl);

  React.useEffect(() => {
    if (!dirty.riskAmount && computedRiskAmount != null) {
      update({ riskAmount: computedRiskAmount.toFixed(2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.accountBalanceAtEntry, values.riskPercent]);

  React.useEffect(() => {
    if (!dirty.plannedRR && computedRR != null) {
      update({ plannedRR: computedRR.toFixed(2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.entryPrice, values.stopLoss, values.takeProfit]);

  React.useEffect(() => {
    if (!dirty.realizedPnl && computedNetPnl != null) {
      update({ realizedPnl: computedNetPnl.toFixed(2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.entryPrice, values.exitPrice, values.positionSize, values.direction, values.fees, values.commission, values.swap]);

  React.useEffect(() => {
    if (!dirty.actualR && computedActualR != null) {
      update({ actualR: computedActualR.toFixed(2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.realizedPnl, values.riskAmount]);

  function update(patch: Partial<TradeFormValues>) {
    onChange({ ...values, ...patch });
  }

  function updateNested<K extends "preTrade" | "duringTrade" | "postTrade">(key: K, patch: Partial<TradeFormValues[K]>) {
    onChange({ ...values, [key]: { ...values[key], ...patch } });
  }

  const checklistComplete = checklist.plan && checklist.risk && checklist.emotion;

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup">Trade Setup</TabsTrigger>
          {screenshotsPanel && <TabsTrigger value="screenshots">Screenshots</TabsTrigger>}
          <TabsTrigger value="psychology">Strategy &amp; Psychology</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="flex flex-col gap-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Instrument">
              <Combobox options={instrumentOptions} value={values.instrument} onChange={(v) => update({ instrument: v })} allowCustom placeholder="Search pairs…" />
            </Field>
            <Field label="Direction">
              <div className="flex gap-2">
                {(["long", "short"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update({ direction: d })}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      values.direction === d
                        ? d === "long"
                          ? "border-profit/40 bg-profit/10 text-profit"
                          : "border-loss/40 bg-loss/10 text-loss"
                        : "border-border text-muted-foreground hover:bg-surface-2"
                    )}
                  >
                    {d === "long" ? "Buy / Long" : "Sell / Short"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Status">
              <Select value={values.status} onValueChange={(v) => update({ status: v as TradeStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Entry Date & Time">
              <Input type="datetime-local" value={values.entryTime} onChange={(e) => update({ entryTime: e.target.value })} required />
            </Field>
            <Field label="Exit Date & Time">
              <Input type="datetime-local" value={values.exitTime} onChange={(e) => update({ exitTime: e.target.value })} />
            </Field>
            <Field label="Setup Grade">
              <Select value={values.setupGrade ?? "none"} onValueChange={(v) => update({ setupGrade: v === "none" ? null : (v as SetupGrade) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ungraded</SelectItem>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Entry Price">
              <Input type="number" step="any" value={values.entryPrice} onChange={(e) => update({ entryPrice: e.target.value })} required />
            </Field>
            <Field label="Stop Loss">
              <Input type="number" step="any" value={values.stopLoss} onChange={(e) => update({ stopLoss: e.target.value })} />
            </Field>
            <Field label="Take Profit">
              <Input type="number" step="any" value={values.takeProfit} onChange={(e) => update({ takeProfit: e.target.value })} />
            </Field>
            <Field label="Exit Price">
              <Input type="number" step="any" value={values.exitPrice} onChange={(e) => update({ exitPrice: e.target.value })} />
            </Field>
            <Field label="Position Size / Lots">
              <Input type="number" step="any" value={values.positionSize} onChange={(e) => update({ positionSize: e.target.value })} required />
            </Field>
            <Field label="Account Balance at Entry">
              <Input type="number" step="any" value={values.accountBalanceAtEntry} onChange={(e) => update({ accountBalanceAtEntry: e.target.value })} required />
            </Field>
            <Field label="Risk %">
              <Input type="number" step="any" value={values.riskPercent} onChange={(e) => update({ riskPercent: e.target.value })} />
            </Field>
            <Field label="Risk Amount" hint={!dirty.riskAmount ? "auto" : undefined} onReset={dirty.riskAmount ? () => setDirty((d) => ({ ...d, riskAmount: false })) : undefined}>
              <Input
                type="number"
                step="any"
                value={values.riskAmount}
                onChange={(e) => {
                  setDirty((d) => ({ ...d, riskAmount: true }));
                  update({ riskAmount: e.target.value });
                }}
              />
            </Field>
            <Field label="Fees">
              <Input type="number" step="any" value={values.fees} onChange={(e) => update({ fees: e.target.value })} />
            </Field>
            <Field label="Commission">
              <Input type="number" step="any" value={values.commission} onChange={(e) => update({ commission: e.target.value })} />
            </Field>
            <Field label="Swap">
              <Input type="number" step="any" value={values.swap} onChange={(e) => update({ swap: e.target.value })} />
            </Field>
            <Field label="Strategy">
              <Select value={values.strategy || "none"} onValueChange={(v) => update({ strategy: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unlabeled</SelectItem>
                  {strategies.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </section>

          <section className="rounded-xl border border-border bg-surface-2/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calculated Results</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Planned RR" hint={!dirty.plannedRR ? "auto" : undefined} onReset={dirty.plannedRR ? () => setDirty((d) => ({ ...d, plannedRR: false })) : undefined}>
                <Input
                  type="number"
                  step="any"
                  value={values.plannedRR}
                  onChange={(e) => {
                    setDirty((d) => ({ ...d, plannedRR: true }));
                    update({ plannedRR: e.target.value });
                  }}
                />
              </Field>
              <Field label="Realized P&L" hint={!dirty.realizedPnl ? "auto" : undefined} onReset={dirty.realizedPnl ? () => setDirty((d) => ({ ...d, realizedPnl: false })) : undefined}>
                <Input
                  type="number"
                  step="any"
                  value={values.realizedPnl}
                  onChange={(e) => {
                    setDirty((d) => ({ ...d, realizedPnl: true }));
                    update({ realizedPnl: e.target.value });
                  }}
                />
              </Field>
              <Field label="Actual R-Multiple" hint={!dirty.actualR ? "auto" : undefined} onReset={dirty.actualR ? () => setDirty((d) => ({ ...d, actualR: false })) : undefined}>
                <Input
                  type="number"
                  step="any"
                  value={values.actualR}
                  onChange={(e) => {
                    setDirty((d) => ({ ...d, actualR: true }));
                    update({ actualR: e.target.value });
                  }}
                />
              </Field>
              <Field label="Result (auto)">
                <div
                  className={cn(
                    "flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium",
                    computedResult === "win" && "text-profit",
                    computedResult === "loss" && "text-loss"
                  )}
                >
                  {computedResult ?? "—"}
                </div>
              </Field>
            </div>
          </section>
        </TabsContent>

        {screenshotsPanel && (
          <TabsContent value="screenshots" className="flex flex-col gap-6">
            {screenshotsPanel}
          </TabsContent>
        )}

        <TabsContent value="psychology" className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pre-Trade Analysis</h3>
            <Field label="Why am I entering this trade?">
              <Textarea value={values.preTrade.entryReason} onChange={(e) => updateNested("preTrade", { entryReason: e.target.value })} />
            </Field>
            <Field label="Fundamental bias">
              <Textarea value={values.preTrade.fundamentalBias} onChange={(e) => updateNested("preTrade", { fundamentalBias: e.target.value })} />
            </Field>
            <Field label="Technical confirmation">
              <Textarea value={values.preTrade.technicalConfirmation} onChange={(e) => updateNested("preTrade", { technicalConfirmation: e.target.value })} />
            </Field>
            <Field label="Trade thesis">
              <Textarea value={values.preTrade.thesis} onChange={(e) => updateNested("preTrade", { thesis: e.target.value })} />
            </Field>
            <Field label="What could invalidate this setup?">
              <Textarea value={values.preTrade.invalidation} onChange={(e) => updateNested("preTrade", { invalidation: e.target.value })} />
            </Field>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">During the Trade</h3>
            <Field label="How am I feeling?">
              <Textarea value={values.duringTrade.feelings} onChange={(e) => updateNested("duringTrade", { feelings: e.target.value })} />
            </Field>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={values.duringTrade.followedPlan} onCheckedChange={(c) => updateNested("duringTrade", { followedPlan: !!c })} />
                Followed trading plan
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={values.duringTrade.movedStopLoss} onCheckedChange={(c) => updateNested("duringTrade", { movedStopLoss: !!c })} />
                Moved stop-loss
              </label>
            </div>
            <Field label="Emotions experienced">
              <EmotionTagPicker value={values.duringTrade.emotions} onChange={(emotions) => updateNested("duringTrade", { emotions })} />
            </Field>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post-Trade Review</h3>
            <Field label="What went well?">
              <Textarea value={values.postTrade.wentWell} onChange={(e) => updateNested("postTrade", { wentWell: e.target.value })} />
            </Field>
            <Field label="What went wrong?">
              <Textarea value={values.postTrade.wentWrong} onChange={(e) => updateNested("postTrade", { wentWrong: e.target.value })} />
            </Field>
            <Field label="What did I learn?">
              <Textarea value={values.postTrade.lessonLearned} onChange={(e) => updateNested("postTrade", { lessonLearned: e.target.value })} />
            </Field>
            <Field label="What should I improve next time?">
              <Textarea value={values.postTrade.improvement} onChange={(e) => updateNested("postTrade", { improvement: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.postTrade.wouldRepeat === true}
                onCheckedChange={(c) => updateNested("postTrade", { wouldRepeat: c ? true : false })}
              />
              Would take this trade again
            </label>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall</h3>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.followedPlan} onCheckedChange={(c) => update({ followedPlan: !!c })} />
              Followed Trading Plan: {values.followedPlan ? "Yes" : "No"}
            </label>
          </section>
        </TabsContent>

        <TabsContent value="checklist" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Run through this before saving. This checklist is a habit prompt — it doesn&apos;t block saving, but unchecked items are a signal to slow down.</p>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/40 p-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checklist.plan} onCheckedChange={(c) => setChecklist((s) => ({ ...s, plan: !!c }))} />
              This trade matches my written trading plan and strategy rules.
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checklist.risk} onCheckedChange={(c) => setChecklist((s) => ({ ...s, risk: !!c }))} />
              Position size and risk % are within my risk limits.
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checklist.emotion} onCheckedChange={(c) => setChecklist((s) => ({ ...s, emotion: !!c }))} />
              I am calm and not trading out of FOMO, greed or revenge.
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checklist.screenshot} onCheckedChange={(c) => setChecklist((s) => ({ ...s, screenshot: !!c }))} />
              I&apos;ve attached (or will attach) a before-entry chart screenshot.
            </label>
          </div>
          {!checklistComplete && (
            <p className="text-xs text-warning">Heads up: not every checklist item is checked yet.</p>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="text-xs text-muted-foreground">
          {computedNetPnl != null && (
            <>
              Preview: <span className={computedNetPnl >= 0 ? "text-profit" : "text-loss"}>{formatCurrency(computedNetPnl)}</span>
              {computedActualR != null && <> · {formatR(computedActualR)}</>}
            </>
          )}
        </div>
        <Button onClick={onSubmit} disabled={submitting} size="lg">
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  onReset,
  children,
}: {
  label: string;
  hint?: string;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        {onReset && (
          <button type="button" onClick={onReset} className="text-muted-foreground hover:text-accent">
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
