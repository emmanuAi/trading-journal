import { describe, it, expect } from "vitest";
import {
  calcPlannedRR,
  calcGrossPnl,
  calcNetPnl,
  calcRiskAmount,
  calcActualR,
  determineResult,
  winRateStats,
  profitFactor,
  maxDrawdownPercent,
  buildEquityCurve,
  currentStreak,
  planCompliance,
  returnPercent,
} from "./calculations";
import type { Trade } from "./types";

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

describe("calcPlannedRR", () => {
  it("computes reward/risk from entry, stop, target", () => {
    expect(calcPlannedRR(1.1, 1.095, 1.11)).toBeCloseTo(2, 5);
  });
  it("returns null when stop equals entry (zero risk)", () => {
    expect(calcPlannedRR(1.1, 1.1, 1.11)).toBeNull();
  });
  it("returns null when any input is missing", () => {
    expect(calcPlannedRR(1.1, null, 1.11)).toBeNull();
  });
});

describe("calcGrossPnl / calcNetPnl", () => {
  it("computes long P&L correctly", () => {
    expect(calcGrossPnl(1.1, 1.11, 10000, "long")).toBeCloseTo(100, 5);
  });
  it("computes short P&L correctly", () => {
    expect(calcGrossPnl(1.1, 1.09, 10000, "short")).toBeCloseTo(100, 5);
  });
  it("subtracts fees/commission and applies swap", () => {
    expect(calcNetPnl(100, 2, 3, -1)).toBeCloseTo(94, 5);
  });
});

describe("calcRiskAmount / calcActualR", () => {
  it("computes risk amount from balance and percent", () => {
    expect(calcRiskAmount(10000, 1)).toBeCloseTo(100, 5);
  });
  it("returns null risk amount when percent is null", () => {
    expect(calcRiskAmount(10000, null)).toBeNull();
  });
  it("computes actual R from net pnl and risk amount", () => {
    expect(calcActualR(250, 100)).toBeCloseTo(2.5, 5);
  });
  it("returns null actual R when risk amount is zero", () => {
    expect(calcActualR(250, 0)).toBeNull();
  });
});

describe("determineResult", () => {
  it("classifies win/loss/breakeven", () => {
    expect(determineResult(50)).toBe("win");
    expect(determineResult(-50)).toBe("loss");
    expect(determineResult(0)).toBe("breakeven");
  });
});

describe("winRateStats", () => {
  it("excludes breakevens from the win-rate denominator", () => {
    const trades = [
      makeTrade({ id: "1", result: "win" }),
      makeTrade({ id: "2", result: "win" }),
      makeTrade({ id: "3", result: "loss" }),
      makeTrade({ id: "4", result: "breakeven" }),
    ];
    const stats = winRateStats(trades);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.breakevens).toBe(1);
    expect(stats.winRate).toBeCloseTo((2 / 3) * 100, 5);
  });
  it("returns null win rate when there are no decisive trades", () => {
    const trades = [makeTrade({ result: "breakeven" })];
    expect(winRateStats(trades).winRate).toBeNull();
  });
  it("ignores open trades entirely", () => {
    const trades = [makeTrade({ status: "open", result: null })];
    expect(winRateStats(trades)).toEqual({ wins: 0, losses: 0, breakevens: 0, winRate: null });
  });
});

describe("profitFactor", () => {
  it("computes gross win / abs(gross loss)", () => {
    const trades = [
      makeTrade({ id: "1", result: "win", realizedPnl: 200 }),
      makeTrade({ id: "2", result: "loss", realizedPnl: -100 }),
    ];
    expect(profitFactor(trades)).toBeCloseTo(2, 5);
  });
  it("returns Infinity when there are wins but zero losses", () => {
    const trades = [makeTrade({ result: "win", realizedPnl: 200 })];
    expect(profitFactor(trades)).toBe(Infinity);
  });
  it("returns null when there is no realized activity", () => {
    expect(profitFactor([])).toBeNull();
  });
});

describe("maxDrawdownPercent", () => {
  it("measures peak-to-trough decline on the realized equity curve", () => {
    const trades = [
      makeTrade({ id: "1", exitTime: "2026-01-01T00:00:00Z", realizedPnl: 1000 }), // 10000 -> 11000
      makeTrade({ id: "2", exitTime: "2026-01-02T00:00:00Z", realizedPnl: -2000 }), // 11000 -> 9000
      makeTrade({ id: "3", exitTime: "2026-01-03T00:00:00Z", realizedPnl: 500 }), // 9000 -> 9500
    ];
    // peak 11000, trough 9000 => dd = 2000/11000 * 100
    expect(maxDrawdownPercent(trades, 10000)).toBeCloseTo((2000 / 11000) * 100, 4);
  });
  it("is zero when equity never falls below starting balance", () => {
    const trades = [makeTrade({ realizedPnl: 100 })];
    expect(maxDrawdownPercent(trades, 10000)).toBe(0);
  });
});

describe("buildEquityCurve", () => {
  it("only moves on closed trades, in chronological order", () => {
    const trades = [
      makeTrade({ id: "2", exitTime: "2026-01-02T00:00:00Z", realizedPnl: 50 }),
      makeTrade({ id: "1", exitTime: "2026-01-01T00:00:00Z", realizedPnl: 100 }),
      makeTrade({ id: "3", status: "open", realizedPnl: null, exitTime: null }),
    ];
    const curve = buildEquityCurve(trades, 1000);
    expect(curve.map((p) => p.tradeId)).toEqual([null, "1", "2"]);
    expect(curve[curve.length - 1].balance).toBeCloseTo(1150, 5);
  });
});

describe("currentStreak", () => {
  it("counts the trailing run of same-result closed trades", () => {
    const trades = [
      makeTrade({ id: "1", exitTime: "2026-01-01T00:00:00Z", result: "loss" }),
      makeTrade({ id: "2", exitTime: "2026-01-02T00:00:00Z", result: "win" }),
      makeTrade({ id: "3", exitTime: "2026-01-03T00:00:00Z", result: "win" }),
    ];
    expect(currentStreak(trades)).toEqual({ type: "win", count: 2 });
  });
});

describe("planCompliance", () => {
  it("computes percentage of closed trades following the plan", () => {
    const trades = [
      makeTrade({ id: "1", followedPlan: true }),
      makeTrade({ id: "2", followedPlan: false }),
      makeTrade({ id: "3", followedPlan: true }),
    ];
    expect(planCompliance(trades)).toBeCloseTo((2 / 3) * 100, 5);
  });
});

describe("returnPercent", () => {
  it("is net P&L over starting balance", () => {
    const trades = [makeTrade({ realizedPnl: 500 })];
    expect(returnPercent(trades, 10000)).toBeCloseTo(5, 5);
  });
  it("returns null for a zero/undefined starting balance", () => {
    expect(returnPercent([], 0)).toBeNull();
  });
});
