import type { Direction, Trade } from "./types";
import { findInstrument } from "./instruments";

/** Planned risk-to-reward ratio from entry/stop/target. Null when inputs are missing or risk is zero. */
export function calcPlannedRR(
  entryPrice: number | null,
  stopLoss: number | null,
  takeProfit: number | null
): number | null {
  if (entryPrice == null || stopLoss == null || takeProfit == null) return null;
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  if (risk === 0) return null;
  return reward / risk;
}

/** Gross P&L before fees/commission/swap, from price action alone. */
export function calcGrossPnl(
  entryPrice: number,
  exitPrice: number,
  positionSize: number,
  direction: Direction
): number {
  const diff = direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return diff * positionSize;
}

export function calcNetPnl(grossPnl: number, fees: number, commission: number, swap: number): number {
  return grossPnl - Math.abs(fees) - Math.abs(commission) + swap;
}

export function calcRiskAmount(accountBalance: number, riskPercent: number | null): number | null {
  if (riskPercent == null || !Number.isFinite(riskPercent)) return null;
  return accountBalance * (riskPercent / 100);
}

/** Actual realized R-multiple: net trade P&L divided by initial monetary risk. Null when risk is unknown/zero. */
export function calcActualR(netPnl: number | null, riskAmount: number | null): number | null {
  if (netPnl == null || riskAmount == null || riskAmount === 0) return null;
  return netPnl / riskAmount;
}

export type TradeResultComputed = "win" | "loss" | "breakeven";

export function determineResult(netPnl: number | null, epsilon = 0.00001): TradeResultComputed | null {
  if (netPnl == null) return null;
  if (netPnl > epsilon) return "win";
  if (netPnl < -epsilon) return "loss";
  return "breakeven";
}

export function holdingDurationHours(entryTime: string, exitTime: string | null): number | null {
  if (!exitTime) return null;
  const ms = new Date(exitTime).getTime() - new Date(entryTime).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
}

// ---------------------------------------------------------------------------
// Aggregate performance metrics over a set of CLOSED trades only.
// ---------------------------------------------------------------------------

export function closedTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.status === "closed");
}

function isClosed(t: Trade) {
  return t.status === "closed";
}

export interface WinRateStats {
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null; // percent, excludes breakevens from denominator
}

export function winRateStats(trades: Trade[]): WinRateStats {
  const closed = trades.filter(isClosed);
  let wins = 0,
    losses = 0,
    breakevens = 0;
  for (const t of closed) {
    if (t.result === "win") wins++;
    else if (t.result === "loss") losses++;
    else if (t.result === "breakeven") breakevens++;
  }
  const denom = wins + losses;
  return { wins, losses, breakevens, winRate: denom > 0 ? (wins / denom) * 100 : null };
}

export function averageWin(trades: Trade[]): number | null {
  const wins = trades.filter(isClosed).filter((t) => t.result === "win" && t.realizedPnl != null);
  if (wins.length === 0) return null;
  return wins.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / wins.length;
}

export function averageLoss(trades: Trade[]): number | null {
  const losses = trades.filter(isClosed).filter((t) => t.result === "loss" && t.realizedPnl != null);
  if (losses.length === 0) return null;
  return losses.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / losses.length;
}

export function averagePlannedRR(trades: Trade[]): number | null {
  const withRR = trades.filter(isClosed).filter((t) => t.plannedRR != null);
  if (withRR.length === 0) return null;
  return withRR.reduce((s, t) => s + (t.plannedRR ?? 0), 0) / withRR.length;
}

export function averageActualR(trades: Trade[]): number | null {
  const withR = trades.filter(isClosed).filter((t) => t.actualR != null);
  if (withR.length === 0) return null;
  return withR.reduce((s, t) => s + (t.actualR ?? 0), 0) / withR.length;
}

/** Profit Factor = gross winning profit / abs(gross losing loss). Null if no losses AND no wins; Infinity if losses are zero but wins exist. */
export function profitFactor(trades: Trade[]): number | null {
  const closed = trades.filter(isClosed);
  const grossWin = closed.filter((t) => (t.realizedPnl ?? 0) > 0).reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const grossLoss = closed.filter((t) => (t.realizedPnl ?? 0) < 0).reduce((s, t) => s + Math.abs(t.realizedPnl ?? 0), 0);
  if (grossWin === 0 && grossLoss === 0) return null;
  if (grossLoss === 0) return Infinity;
  return grossWin / grossLoss;
}

export function totalR(trades: Trade[]): number | null {
  const withR = trades.filter(isClosed).filter((t) => t.actualR != null);
  if (withR.length === 0) return null;
  return withR.reduce((s, t) => s + (t.actualR ?? 0), 0);
}

export function largestWin(trades: Trade[]): number | null {
  const wins = trades.filter(isClosed).filter((t) => t.result === "win" && t.realizedPnl != null);
  if (wins.length === 0) return null;
  return Math.max(...wins.map((t) => t.realizedPnl ?? 0));
}

export function largestLoss(trades: Trade[]): number | null {
  const losses = trades.filter(isClosed).filter((t) => t.result === "loss" && t.realizedPnl != null);
  if (losses.length === 0) return null;
  return Math.min(...losses.map((t) => t.realizedPnl ?? 0));
}

export function netPnl(trades: Trade[]): number {
  return trades.filter(isClosed).reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
}

export function returnPercent(trades: Trade[], startingBalance: number): number | null {
  if (!startingBalance || startingBalance <= 0) return null;
  return (netPnl(trades) / startingBalance) * 100;
}

/** Current win/loss streak based on chronological exit order of closed trades. */
export function currentStreak(trades: Trade[]): { type: "win" | "loss" | "none"; count: number } {
  const closed = trades
    .filter(isClosed)
    .filter((t) => t.result === "win" || t.result === "loss")
    .slice()
    .sort((a, b) => new Date(a.exitTime ?? a.entryTime).getTime() - new Date(b.exitTime ?? b.entryTime).getTime());
  if (closed.length === 0) return { type: "none", count: 0 };
  const last = closed[closed.length - 1];
  const type = last.result as "win" | "loss";
  let count = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (closed[i].result === type) count++;
    else break;
  }
  return { type, count };
}

export function planCompliance(trades: Trade[]): number | null {
  const closed = trades.filter(isClosed);
  if (closed.length === 0) return null;
  const compliant = closed.filter((t) => t.followedPlan).length;
  return (compliant / closed.length) * 100;
}

/** Maximum drawdown (%) of the realized equity curve built from chronological closed trades. */
export function maxDrawdownPercent(trades: Trade[], startingBalance: number): number {
  const points = buildEquityCurve(trades, startingBalance);
  let peak = startingBalance;
  let maxDd = 0;
  for (const p of points) {
    if (p.balance > peak) peak = p.balance;
    if (peak > 0) {
      const dd = ((peak - p.balance) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

export interface EquityPoint {
  date: string;
  tradeId: string | null;
  balance: number;
  cumulativePnl: number;
  pctGrowth: number;
  cumulativeR: number;
}

/** Realized equity curve: only closed trades move the curve. Sorted chronologically by exit time. */
export function buildEquityCurve(trades: Trade[], startingBalance: number): EquityPoint[] {
  const closed = trades
    .filter(isClosed)
    .slice()
    .sort((a, b) => new Date(a.exitTime ?? a.entryTime).getTime() - new Date(b.exitTime ?? b.entryTime).getTime());

  let balance = startingBalance;
  let cumulativePnl = 0;
  let cumulativeR = 0;
  const points: EquityPoint[] = [
    { date: closed[0]?.exitTime ?? new Date().toISOString(), tradeId: null, balance, cumulativePnl, pctGrowth: 0, cumulativeR: 0 },
  ];
  for (const t of closed) {
    const pnl = t.realizedPnl ?? 0;
    balance += pnl;
    cumulativePnl += pnl;
    cumulativeR += t.actualR ?? 0;
    points.push({
      date: t.exitTime ?? t.entryTime,
      tradeId: t.id,
      balance,
      cumulativePnl,
      pctGrowth: startingBalance > 0 ? (cumulativePnl / startingBalance) * 100 : 0,
      cumulativeR,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Breakdown / grouping helpers
// ---------------------------------------------------------------------------

export interface GroupStat {
  key: string;
  trades: number;
  winRate: number | null;
  netPnl: number;
  profitFactor: number | null;
  avgR: number | null;
}

function groupStatsBy(trades: Trade[], keyFn: (t: Trade) => string): GroupStat[] {
  const closed = trades.filter(isClosed);
  const map = new Map<string, Trade[]>();
  for (const t of closed) {
    const key = keyFn(t);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([key, group]) => ({
    key,
    trades: group.length,
    winRate: winRateStats(group).winRate,
    netPnl: netPnl(group),
    profitFactor: profitFactor(group),
    avgR: averageActualR(group),
  }));
}

export function statsByInstrument(trades: Trade[]): GroupStat[] {
  return groupStatsBy(trades, (t) => t.instrument);
}

export function statsByStrategy(trades: Trade[]): GroupStat[] {
  return groupStatsBy(trades, (t) => t.strategy || "Unlabeled");
}

export function statsByDirection(trades: Trade[]): GroupStat[] {
  return groupStatsBy(trades, (t) => t.direction);
}

export function statsByMonth(trades: Trade[]): GroupStat[] {
  return groupStatsBy(trades, (t) => (t.exitTime ?? t.entryTime).slice(0, 7));
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function statsByDayOfWeek(trades: Trade[]): GroupStat[] {
  return groupStatsBy(trades, (t) => DAY_NAMES[new Date(t.exitTime ?? t.entryTime).getDay()]);
}

export function statsByEmotion(trades: Trade[]): GroupStat[] {
  const closed = trades.filter(isClosed);
  const map = new Map<string, Trade[]>();
  for (const t of closed) {
    const tags = t.emotionTags.length > 0 ? t.emotionTags : ["Untagged"];
    for (const tag of tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(t);
    }
  }
  return Array.from(map.entries()).map(([key, group]) => ({
    key,
    trades: group.length,
    winRate: winRateStats(group).winRate,
    netPnl: netPnl(group),
    profitFactor: profitFactor(group),
    avgR: averageActualR(group),
  }));
}

export function statsByPlanCompliance(trades: Trade[]): GroupStat[] {
  return groupStatsBy(trades, (t) => (t.followedPlan ? "Followed Plan" : "Broke Plan"));
}

export function expectancyR(trades: Trade[]): number | null {
  return averageActualR(trades);
}

export function averageHoldingDurationHours(trades: Trade[]): number | null {
  const closed = trades.filter(isClosed);
  const durations = closed.map((t) => holdingDurationHours(t.entryTime, t.exitTime)).filter((d): d is number => d != null);
  if (durations.length === 0) return null;
  return durations.reduce((s, d) => s + d, 0) / durations.length;
}

export interface DrawdownPoint {
  date: string;
  drawdownPercent: number;
}

export function buildDrawdownSeries(trades: Trade[], startingBalance: number): DrawdownPoint[] {
  const points = buildEquityCurve(trades, startingBalance);
  let peak = startingBalance;
  return points.map((p) => {
    if (p.balance > peak) peak = p.balance;
    const dd = peak > 0 ? ((peak - p.balance) / peak) * 100 : 0;
    return { date: p.date, drawdownPercent: -dd };
  });
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  netPnl: number;
  trades: number;
}

export function calendarDailyPnl(trades: Trade[]): Map<string, CalendarDay> {
  const closed = trades.filter(isClosed);
  const map = new Map<string, CalendarDay>();
  for (const t of closed) {
    const date = (t.exitTime ?? t.entryTime).slice(0, 10);
    const existing = map.get(date) ?? { date, netPnl: 0, trades: 0 };
    existing.netPnl += t.realizedPnl ?? 0;
    existing.trades += 1;
    map.set(date, existing);
  }
  return map;
}

/** Price movement in pips (or the instrument's natural unit, e.g. points for
 * an index) between an entry and exit price. Null — never 0 — when either
 * price is missing or the instrument isn't one with a known pip size (a
 * custom/typed-in symbol not in the instrument list). Used both live in the
 * trade form (before a trade is saved) and for stored trades. */
export function calcPipsFromPrices(
  entryPrice: number | null,
  exitPrice: number | null,
  direction: Direction,
  instrumentSymbol: string
): number | null {
  if (entryPrice == null || exitPrice == null) return null;
  const instrument = findInstrument(instrumentSymbol);
  if (!instrument || instrument.pipSize <= 0) return null;
  const diff = direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return diff / instrument.pipSize;
}

/** Realized pips for one closed trade — null (never 0) when the trade isn't
 * closed or either price is missing/unmatched. See calcPipsFromPrices. */
export function calcRealizedPips(trade: Trade): number | null {
  if (trade.status !== "closed") return null;
  return calcPipsFromPrices(trade.entryPrice, trade.exitPrice, trade.direction, trade.instrument);
}

export interface PipStatistics {
  totalNetPips: number | null;
  avgPipsPerTrade: number | null;
  avgWinningPips: number | null;
  avgLosingPips: number | null;
  avgMaxDrawdownPips: number | null;
  largestMaxDrawdownPips: number | null;
  /** Closed trades where realized pips could be computed. */
  tradesWithPips: number;
  /** Closed trades excluded because the instrument has no known pip size. */
  tradesMissingPips: number;
}

/** Aggregates realized-pip performance across closed trades. Every average
 * is computed only over trades where a real value is known — missing data
 * is excluded from the denominator, never counted as 0, so one untracked
 * trade can't silently drag down (or inflate) an average. */
export function pipStatistics(trades: Trade[]): PipStatistics {
  const closed = trades.filter(isClosed);
  const withPips = closed.map((t) => ({ trade: t, pips: calcRealizedPips(t) }));
  const known = withPips.filter((x): x is { trade: Trade; pips: number } => x.pips !== null);
  const wins = known.filter((x) => x.pips > 0);
  const losses = known.filter((x) => x.pips < 0);

  const sum = (xs: { pips: number }[]) => xs.reduce((s, x) => s + x.pips, 0);

  const ddValues = closed.map((t) => t.maxDrawdownPips).filter((v): v is number => v != null);

  return {
    totalNetPips: known.length > 0 ? sum(known) : null,
    avgPipsPerTrade: known.length > 0 ? sum(known) / known.length : null,
    avgWinningPips: wins.length > 0 ? sum(wins) / wins.length : null,
    avgLosingPips: losses.length > 0 ? sum(losses) / losses.length : null,
    avgMaxDrawdownPips: ddValues.length > 0 ? ddValues.reduce((s, v) => s + v, 0) / ddValues.length : null,
    largestMaxDrawdownPips: ddValues.length > 0 ? Math.max(...ddValues) : null,
    tradesWithPips: known.length,
    tradesMissingPips: closed.length - known.length,
  };
}
