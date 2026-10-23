import type { Trade } from "@/lib/types";
import {
  winRateStats,
  netPnl,
  profitFactor,
  averageActualR,
  totalR,
  largestWin,
  largestLoss,
  maxDrawdownPercent,
  currentStreak,
  planCompliance,
  returnPercent,
  pipStatistics,
  type PipStatistics,
} from "@/lib/calculations";

export interface WeekWindow {
  /** Monday, YYYY-MM-DD, in the owner's local timezone. */
  weekStart: string;
  /** Sunday, YYYY-MM-DD, in the owner's local timezone (inclusive). */
  weekEnd: string;
  /** UTC instant for weekStart 00:00:00.000 local. */
  startISO: string;
  /** UTC instant for the end of weekEnd (exclusive upper bound) local. */
  endISO: string;
}

/** Converts a local wall-clock date/time in an IANA timezone to the
 * corresponding UTC instant. Standard two-pass correction: format an initial
 * UTC guess back through the target timezone, measure the drift, and
 * re-apply it — converges exactly except in the ~1hr window either side of
 * a DST transition, where it's off by at most the transition's own size
 * (acceptable for a weekly-boundary calculation; see tests). */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const asIfLocal = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) === 24 ? 0 : Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    guess += Date.UTC(year, month - 1, day, hour, minute, second) - asIfLocal;
  }
  return new Date(guess);
}

/** 1 (Monday) .. 7 (Sunday) for `date` as rendered in `timeZone`. */
function localIsoWeekday(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[weekday];
}

function localYmd(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function addDays(y: number, m: number, d: number, delta: number): { year: number; month: number; day: number } {
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12));
  utcNoon.setUTCDate(utcNoon.getUTCDate() + delta);
  return { year: utcNoon.getUTCFullYear(), month: utcNoon.getUTCMonth() + 1, day: utcNoon.getUTCDate() };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The Monday–Sunday week window in the owner's local timezone, `weeksAgo`
 * full weeks back from the week containing `now` (1 = the most recently
 * *completed* week — the normal case for a retrospective report; 0 = the
 * current, still-in-progress week). Monday-start matches the rest of the
 * app's calendar conventions (MiniCalendar, CalendarHeatmap). */
export function getLocalWeekWindow(now: Date, timezone: string, weeksAgo = 1): WeekWindow {
  const today = localYmd(now, timezone);
  const weekday = localIsoWeekday(now, timezone); // 1=Mon..7=Sun
  const daysToThisMonday = weekday - 1;

  const monday = addDays(today.year, today.month, today.day, -daysToThisMonday - weeksAgo * 7);
  const sunday = addDays(monday.year, monday.month, monday.day, 6);
  const afterSunday = addDays(sunday.year, sunday.month, sunday.day, 1);

  const startUtc = zonedTimeToUtc(monday.year, monday.month, monday.day, 0, 0, 0, timezone);
  const endUtc = zonedTimeToUtc(afterSunday.year, afterSunday.month, afterSunday.day, 0, 0, 0, timezone);

  return {
    weekStart: `${monday.year}-${pad(monday.month)}-${pad(monday.day)}`,
    weekEnd: `${sunday.year}-${pad(sunday.month)}-${pad(sunday.day)}`,
    startISO: startUtc.toISOString(),
    endISO: endUtc.toISOString(),
  };
}

export interface WeeklySnapshot {
  weekStart: string;
  weekEnd: string;
  currency: string;
  tradesCount: number;
  hasTrades: boolean;
  stats: {
    winRate: number | null;
    wins: number;
    losses: number;
    breakevens: number;
    netPnl: number;
    profitFactor: number | null;
    avgActualR: number | null;
    totalR: number | null;
    largestWin: number | null;
    largestLoss: number | null;
    maxDrawdownPercent: number;
    streak: { type: "win" | "loss" | "none"; count: number };
    planCompliancePercent: number | null;
    returnPercent: number | null;
  };
  pips: PipStatistics;
}

/** Pure: given trades already scoped to one week window and the account's
 * starting balance/currency, builds the deterministic snapshot handed to
 * the AI for interpretation. No network, no Supabase — fully unit-testable.
 * A week with zero trades is a valid snapshot (hasTrades: false), not an
 * error — the AI still gets a real, honest "nothing happened" payload
 * rather than the report being silently skipped. */
export function buildWeeklySnapshot(window: WeekWindow, weekTrades: Trade[], startingBalance: number, currency: string): WeeklySnapshot {
  const win = winRateStats(weekTrades);
  return {
    weekStart: window.weekStart,
    weekEnd: window.weekEnd,
    currency,
    tradesCount: weekTrades.length,
    hasTrades: weekTrades.length > 0,
    stats: {
      winRate: win.winRate,
      wins: win.wins,
      losses: win.losses,
      breakevens: win.breakevens,
      netPnl: netPnl(weekTrades),
      profitFactor: profitFactor(weekTrades),
      avgActualR: averageActualR(weekTrades),
      totalR: totalR(weekTrades),
      largestWin: largestWin(weekTrades),
      largestLoss: largestLoss(weekTrades),
      maxDrawdownPercent: maxDrawdownPercent(weekTrades, startingBalance),
      streak: currentStreak(weekTrades),
      planCompliancePercent: planCompliance(weekTrades),
      returnPercent: returnPercent(weekTrades, startingBalance),
    },
    pips: pipStatistics(weekTrades),
  };
}
