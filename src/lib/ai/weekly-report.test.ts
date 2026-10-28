import { describe, it, expect } from "vitest";
import { summarizeJournalNotes, ReportInterpretationSchema } from "./weekly-report";
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

describe("summarizeJournalNotes", () => {
  it("omits a trade entirely when every note field is blank", () => {
    const trades = [makeTrade({ id: "1" })];
    expect(summarizeJournalNotes(trades)).toEqual([]);
  });

  it("includes only the non-blank fields for a trade with some notes", () => {
    const trades = [
      makeTrade({
        id: "1",
        postTrade: { wentWell: "Waited for confirmation", wentWrong: "", lessonLearned: "", wouldRepeat: null, improvement: "" },
      }),
    ];
    const notes = summarizeJournalNotes(trades);
    expect(notes).toHaveLength(1);
    expect(notes[0].wentWell).toBe("Waited for confirmation");
    expect(notes[0].wentWrong).toBeUndefined();
    expect(notes[0].lessonLearned).toBeUndefined();
  });

  it("truncates an overly long note field rather than sending it in full", () => {
    const longText = "x".repeat(1000);
    const trades = [makeTrade({ id: "1", postTrade: { wentWell: longText, wentWrong: "", lessonLearned: "", wouldRepeat: null, improvement: "" } })];
    const notes = summarizeJournalNotes(trades);
    expect(notes[0].wentWell!.length).toBeLessThan(300);
    expect(notes[0].wentWell!.endsWith("…")).toBe(true);
  });

  it("caps the number of trades included to bound token cost on a busy week", () => {
    const trades = Array.from({ length: 30 }, (_, i) =>
      makeTrade({
        id: `t${i}`,
        exitTime: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
        postTrade: { wentWell: "note", wentWrong: "", lessonLearned: "", wouldRepeat: null, improvement: "" },
      })
    );
    const notes = summarizeJournalNotes(trades);
    expect(notes.length).toBeLessThanOrEqual(20);
  });

  it("includes emotion tags even when text fields are blank", () => {
    const trades = [makeTrade({ id: "1", duringTrade: { feelings: "", followedPlan: true, movedStopLoss: false, emotions: ["fear", "fomo"] } })];
    const notes = summarizeJournalNotes(trades);
    expect(notes).toHaveLength(1);
    expect(notes[0].emotionTags).toEqual(["fear", "fomo"]);
  });
});

describe("ReportInterpretationSchema", () => {
  it("requires exactly three action items — the structural guarantee behind 'three specific actionable improvements'", () => {
    const base = {
      overview: "ok",
      strengths: [],
      weaknesses: [],
      patterns: [],
      evidenceNote: "n/a",
    };
    expect(
      ReportInterpretationSchema.safeParse({ ...base, actionItems: [{ title: "a", detail: "b" }, { title: "a", detail: "b" }] }).success
    ).toBe(false);
    expect(
      ReportInterpretationSchema.safeParse({
        ...base,
        actionItems: [
          { title: "a", detail: "b" },
          { title: "a", detail: "b" },
          { title: "a", detail: "b" },
        ],
      }).success
    ).toBe(true);
  });
});
