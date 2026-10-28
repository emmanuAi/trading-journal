import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLocalWeekWindow } from "@/lib/ai/weekly-snapshot";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/repository/accounts", () => ({
  listAccounts: vi.fn(),
}));
vi.mock("@/lib/repository/trades", () => ({
  listTrades: vi.fn(),
}));
vi.mock("@/lib/repository/settings", () => ({
  getSettings: vi.fn(),
}));
vi.mock("@/lib/repository/weekly-reports", () => ({
  listReports: vi.fn(),
  getReportForWeek: vi.fn(),
  insertReport: vi.fn(),
  regenerateReport: vi.fn(),
  UNIQUE_VIOLATION_CODE: "23505",
}));
vi.mock("@/lib/ai/weekly-report", () => ({
  interpretWeeklyReport: vi.fn(),
  REPORT_MAX_OUTPUT_TOKENS: 2048,
}));

import { createClient, requireUser } from "@/lib/supabase/server";
import { listAccounts } from "@/lib/repository/accounts";
import { listTrades } from "@/lib/repository/trades";
import { getSettings } from "@/lib/repository/settings";
import { listReports, getReportForWeek, insertReport, regenerateReport } from "@/lib/repository/weekly-reports";
import { interpretWeeklyReport } from "@/lib/ai/weekly-report";
import { POST } from "./route";

const TIMEZONE = "UTC";
const MONDAY = getLocalWeekWindow(new Date(), TIMEZONE, 0).weekStart; // current week's Monday — always valid, never future

const ACCOUNT = {
  id: "acc-1",
  name: "Personal",
  type: "personal" as const,
  baseCurrency: "EUR",
  startingBalance: 10000,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const SAVED_REPORT = {
  id: "report-1",
  accountId: "acc-1",
  weekStart: MONDAY,
  weekEnd: MONDAY,
  statsSnapshot: {} as never,
  summaryText: "{}",
  modelUsed: "claude-sonnet-5",
  tradesCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "TJ-1",
    accountId: "acc-1",
    isDemo: false,
    instrument: "EURUSD",
    direction: "long",
    entryTime: `${MONDAY}T10:00:00.000Z`,
    exitTime: `${MONDAY}T12:00:00.000Z`,
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
    createdAt: `${MONDAY}T10:00:00.000Z`,
    updatedAt: `${MONDAY}T12:00:00.000Z`,
    ...overrides,
  };
}

function makeQueryChain(result: { count?: number | null; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.neq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function makeSupabase(opts: { usageCount?: number; countError?: unknown; reserveAllowed?: boolean; reserveError?: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- second param widens the mock's call-tuple type so `.mock.calls[n][1]` below type-checks.
  const rpc = vi.fn((fn: string, args?: Record<string, unknown>) => {
    if (fn === "reserve_ai_spend") {
      return Promise.resolve({ data: [{ log_id: "log-1", allowed: opts.reserveAllowed ?? true }], error: opts.reserveError ?? null });
    }
    if (fn === "reconcile_ai_spend") {
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  return {
    from: vi.fn(() => makeQueryChain({ count: opts.usageCount ?? 0, error: opts.countError ?? null })),
    rpc,
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/coach/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(requireUser).mockReset();
  vi.mocked(listAccounts).mockReset();
  vi.mocked(listTrades).mockReset();
  vi.mocked(getSettings).mockReset();
  vi.mocked(listReports).mockReset();
  vi.mocked(getReportForWeek).mockReset();
  vi.mocked(insertReport).mockReset();
  vi.mocked(regenerateReport).mockReset();
  vi.mocked(interpretWeeklyReport).mockReset();

  vi.mocked(listAccounts).mockResolvedValue([ACCOUNT]);
  vi.mocked(getSettings).mockResolvedValue({
    baseCurrency: "EUR",
    timezone: TIMEZONE,
    defaultAccountId: null,
    defaultRiskPercent: 1,
    strategies: [],
    customTags: [],
    showDemoData: true,
    autoWeeklyReportsEnabled: false,
  });
  vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);
  vi.mocked(insertReport).mockResolvedValue(SAVED_REPORT as never);
  vi.mocked(regenerateReport).mockResolvedValue(SAVED_REPORT as never);
});

describe("POST /api/coach/reports — authentication", () => {
  it("returns 401 and touches nothing else when there is no authenticated user", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(requireUser).mockRejectedValue(new Error("Not authenticated."));

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(401);
    expect(listAccounts).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/reports — account isolation", () => {
  it("returns 400 for an accountId the user does not own", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "someone-elses-account" }));
    expect(res.status).toBe(400);
    expect(interpretWeeklyReport).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/reports — week validation", () => {
  it("returns 400 for a weekStart that isn't actually a Monday", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    const notMonday = new Date(`${MONDAY}T12:00:00.000Z`);
    notMonday.setUTCDate(notMonday.getUTCDate() + 2);

    const res = await POST(makeRequest({ weekStart: notMonday.toISOString().slice(0, 10), accountId: "acc-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a future week", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    const future = new Date(`${MONDAY}T12:00:00.000Z`);
    future.setUTCDate(future.getUTCDate() + 70);
    const futureMonday = getLocalWeekWindow(future, TIMEZONE, 0).weekStart;

    const res = await POST(makeRequest({ weekStart: futureMonday, accountId: "acc-1" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/coach/reports — avoiding unnecessary spend", () => {
  it("serves an existing report with zero AI calls when regenerate is not set", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(getReportForWeek).mockResolvedValue(SAVED_REPORT as never);

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(interpretWeeklyReport).not.toHaveBeenCalled();
    expect(insertReport).not.toHaveBeenCalled();
  });

  it("skips the AI call entirely and reserves no budget for a week with no trades", async () => {
    const supabase = makeSupabase({});
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(getReportForWeek).mockResolvedValue(null);
    vi.mocked(listTrades).mockResolvedValue([]);

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(200);
    expect(interpretWeeklyReport).not.toHaveBeenCalled();
    const reserveCall = supabase.rpc.mock.calls.find((c) => c[0] === "reserve_ai_spend");
    expect(reserveCall).toBeUndefined();
    expect(insertReport).toHaveBeenCalledWith(expect.objectContaining({ modelUsed: "none", tradesCount: 0 }));
  });
});

describe("POST /api/coach/reports — budget and rate limit controls", () => {
  it("returns 402 and never calls the AI when the monthly budget is exhausted", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ reserveAllowed: false }) as never);
    vi.mocked(getReportForWeek).mockResolvedValue(null);
    vi.mocked(listTrades).mockResolvedValue([makeTrade()] as never);

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(402);
    expect(interpretWeeklyReport).not.toHaveBeenCalled();
  });

  it("returns 429 when the daily report generation limit is already hit", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ usageCount: 10 }) as never);
    vi.mocked(getReportForWeek).mockResolvedValue(null);
    vi.mocked(listTrades).mockResolvedValue([makeTrade()] as never);

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(429);
    expect(interpretWeeklyReport).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/reports — successful generation", () => {
  it("generates, saves via insertReport, and returns cached: false", async () => {
    const supabase = makeSupabase({});
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(getReportForWeek).mockResolvedValue(null);
    vi.mocked(listTrades).mockResolvedValue([makeTrade()] as never);
    vi.mocked(interpretWeeklyReport).mockResolvedValue({
      interpretation: { overview: "x", strengths: [], weaknesses: [], patterns: [], actionItems: [], evidenceNote: "x" } as never,
      usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    });

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(insertReport).toHaveBeenCalled();
    expect(regenerateReport).not.toHaveBeenCalled();
  });

  it("calls regenerateReport instead of insertReport when regenerate is true and a report exists", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(getReportForWeek).mockResolvedValue(SAVED_REPORT as never);
    vi.mocked(listTrades).mockResolvedValue([makeTrade()] as never);
    vi.mocked(interpretWeeklyReport).mockResolvedValue({
      interpretation: { overview: "x", strengths: [], weaknesses: [], patterns: [], actionItems: [], evidenceNote: "x" } as never,
      usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    });

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1", regenerate: true }));
    expect(res.status).toBe(200);
    expect(regenerateReport).toHaveBeenCalled();
    expect(insertReport).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/reports — duplicate-click race safety", () => {
  it("serves the winner's row instead of erroring when a concurrent insert wins the unique-constraint race", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(getReportForWeek).mockResolvedValueOnce(null).mockResolvedValueOnce(SAVED_REPORT as never);
    vi.mocked(listTrades).mockResolvedValue([makeTrade()] as never);
    vi.mocked(interpretWeeklyReport).mockResolvedValue({
      interpretation: { overview: "x", strengths: [], weaknesses: [], patterns: [], actionItems: [], evidenceNote: "x" } as never,
      usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    });
    vi.mocked(insertReport).mockRejectedValue({ code: "23505", message: "duplicate key" });

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(json.report.id).toBe(SAVED_REPORT.id);
  });
});

describe("POST /api/coach/reports — error handling", () => {
  it("reconciles with 0 and returns a safe error when the AI call throws", async () => {
    const supabase = makeSupabase({});
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(getReportForWeek).mockResolvedValue(null);
    vi.mocked(listTrades).mockResolvedValue([makeTrade()] as never);
    vi.mocked(interpretWeeklyReport).mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest({ weekStart: MONDAY, accountId: "acc-1" }));
    expect(res.status).toBe(500);
    const reconcileCall = supabase.rpc.mock.calls.find((c) => c[0] === "reconcile_ai_spend");
    expect(reconcileCall?.[1]).toMatchObject({ p_log_id: "log-1", p_actual_usd: 0 });
    expect(insertReport).not.toHaveBeenCalled();
  });

  it("rejects an invalid request body before touching the database", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);

    const res = await POST(makeRequest({ weekStart: "not-a-date" }));
    expect(res.status).toBe(400);
    expect(listAccounts).not.toHaveBeenCalled();
  });
});
