import { describe, it, expect } from "vitest";
import { getLocalWeekWindow, buildWeeklySnapshot } from "./weekly-snapshot";
import type { Trade } from "@/lib/types";

function makeTrade(overrides: Partial<Trade>): Trade {
  return {
    id: "TJ-00001",
    accountId: "acc-1",
    isDemo: false,
    instrument: "EURUSD",
    direction: "long",
    entryTime: "2026-01-01T10:00:00.000Z",
    exitTime: "2026-01-01T12:00:00.000Z",
    entryPrice: 1.1,
    stopLoss: 1.095,
    takeProfit: 1.11,
    exitPrice: 1.11,
    positionSize: 10000,
    accountBalanceAtEntry: 10000,
    riskPercent: 1,
    riskAmount: 100,
    fees: 0,
    commission: 0,
    swap: 0,
    status: "closed",
    result: "win",
    realizedPnl: 100,
    plannedRR: 2,
    actualR: 1,
    maxDrawdownPips: null,
    strategy: "Breakout",
    setupGrade: "A",
    followedPlan: true,
    emotionTags: [],
    customTags: [],
    preTrade: { entryReason: "", fundamentalBias: "", technicalConfirmation: "", thesis: "", invalidation: "" },
    duringTrade: { feelings: "", followedPlan: true, movedStopLoss: false, emotions: [] },
    postTrade: { wentWell: "", wentWrong: "", lessonLearned: "", wouldRepeat: null, improvement: "" },
    screenshots: [],
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("getLocalWeekWindow", () => {
  it("returns the Monday-Sunday window containing `now`, for weeksAgo=0", () => {
    // Wednesday 2026-01-07 12:00 UTC, Europe/Amsterdam (UTC+1 in January)
    const now = new Date("2026-01-07T12:00:00.000Z");
    const window = getLocalWeekWindow(now, "Europe/Amsterdam", 0);
    expect(window.weekStart).toBe("2026-01-05"); // Monday
    expect(window.weekEnd).toBe("2026-01-11"); // Sunday
    expect(window.startISO).toBe(new Date("2026-01-04T23:00:00.000Z").toISOString());
    expect(window.endISO).toBe(new Date("2026-01-11T23:00:00.000Z").toISOString());
  });

  it("returns the previous completed week for weeksAgo=1", () => {
    const now = new Date("2026-01-07T12:00:00.000Z"); // Wed, week of Jan 5-11
    const window = getLocalWeekWindow(now, "Europe/Amsterdam", 1);
    expect(window.weekStart).toBe("2025-12-29");
    expect(window.weekEnd).toBe("2026-01-04");
  });

  it("is stable across a DST transition week (America/New_York spring-forward 2026-03-08)", () => {
    // Sunday 2026-03-08 is the US spring-forward DST transition day.
    const now = new Date("2026-03-12T12:00:00.000Z"); // Thursday, in the week right after
    const window = getLocalWeekWindow(now, "America/New_York", 1);
    expect(window.weekStart).toBe("2026-03-02");
    expect(window.weekEnd).toBe("2026-03-08");
    // Mar 2 is EST (UTC-5): 00:00 local = 05:00 UTC
    expect(window.startISO).toBe(new Date("2026-03-02T05:00:00.000Z").toISOString());
    // Mar 9 00:00 local is EDT (UTC-4): 04:00 UTC
    expect(window.endISO).toBe(new Date("2026-03-09T04:00:00.000Z").toISOString());
  });

  it("starts weeks on Monday regardless of which weekday `now` falls on", () => {
    const sunday = new Date("2026-01-11T23:30:00.000Z"); // late Sunday UTC, still within week in Amsterdam (Mon 00:30 local)
    const window = getLocalWeekWindow(sunday, "Europe/Amsterdam", 0);
    expect(window.weekStart).toBe("2026-01-12");
    expect(window.weekEnd).toBe("2026-01-18");
  });
});

describe("buildWeeklySnapshot", () => {
  const window = getLocalWeekWindow(new Date("2026-01-07T12:00:00.000Z"), "Europe/Amsterdam", 0);

  it("represents a no-trade week as a valid, explicit state rather than an error", () => {
    const snapshot = buildWeeklySnapshot(window, [], 10000, "EUR");
    expect(snapshot.hasTrades).toBe(false);
    expect(snapshot.tradesCount).toBe(0);
    expect(snapshot.stats.winRate).toBeNull();
    expect(snapshot.stats.netPnl).toBe(0);
  });

  it("derives every stat from the shared calculations.ts functions, not ad-hoc math", () => {
    const trades = [
      makeTrade({ id: "1", result: "win", realizedPnl: 200, exitTime: "2026-01-06T00:00:00Z" }),
      makeTrade({ id: "2", result: "loss", realizedPnl: -100, exitTime: "2026-01-07T00:00:00Z" }),
    ];
    const snapshot = buildWeeklySnapshot(window, trades, 10000, "EUR");
    expect(snapshot.hasTrades).toBe(true);
    expect(snapshot.tradesCount).toBe(2);
    expect(snapshot.stats.wins).toBe(1);
    expect(snapshot.stats.losses).toBe(1);
    expect(snapshot.stats.netPnl).toBe(100);
    expect(snapshot.stats.profitFactor).toBeCloseTo(2, 5);
  });
});
