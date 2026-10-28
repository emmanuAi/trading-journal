import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/ai/cron-lease", () => ({
  claimLease: vi.fn(),
  releaseLease: vi.fn(),
  WEEKLY_REPORTS_JOB_NAME: "weekly-reports",
  MAX_ATTEMPTS: 5,
}));
vi.mock("@/lib/repository/cron-reports", () => ({
  listOptedInOwnerIds: vi.fn(),
  getOwnerSettings: vi.fn(),
  getOwnerAccounts: vi.fn(),
  getOwnerTradesForWindow: vi.fn(),
  hasExistingReport: vi.fn(),
  saveScheduledReport: vi.fn(),
}));
vi.mock("@/lib/ai/weekly-report", () => ({
  interpretWeeklyReport: vi.fn(),
  REPORT_MAX_OUTPUT_TOKENS: 2048,
}));

import { createServiceClient } from "@/lib/supabase/service";
import { claimLease, releaseLease } from "@/lib/ai/cron-lease";
import {
  listOptedInOwnerIds,
  getOwnerSettings,
  getOwnerAccounts,
  getOwnerTradesForWindow,
  hasExistingReport,
  saveScheduledReport,
} from "@/lib/repository/cron-reports";
import { interpretWeeklyReport } from "@/lib/ai/weekly-report";
import { getLocalWeekWindow } from "@/lib/ai/weekly-snapshot";
import type { Trade } from "@/lib/types";
import { GET } from "./route";

const CRON_SECRET = "test-cron-secret-for-unit-tests-only";
const TIMEZONE = "UTC";

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    baseCurrency: "EUR",
    timezone: TIMEZONE,
    defaultAccountId: null,
    defaultRiskPercent: 1,
    strategies: [],
    customTags: [],
    showDemoData: true,
    autoWeeklyReportsEnabled: true,
    ...overrides,
  };
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-1",
    name: "Personal",
    type: "personal" as const,
    baseCurrency: "EUR",
    startingBalance: 10000,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "TJ-1",
    accountId: "acc-1",
    isDemo: false,
    instrument: "EURUSD",
    direction: "long",
    entryTime: "2026-10-12T10:00:00.000Z",
    exitTime: "2026-10-12T12:00:00.000Z",
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
    createdAt: "2026-10-12T10:00:00.000Z",
    updatedAt: "2026-10-12T12:00:00.000Z",
    ...overrides,
  };
}

function makeRequest(authHeader?: string) {
  return new Request("http://localhost/api/cron/weekly-reports", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function mockServiceClient(reserveAllowed: Record<string, boolean> = {}) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "reserve_ai_spend_for_owner") {
      const ownerId = args.p_owner as string;
      const allowed = reserveAllowed[ownerId] ?? true;
      return { data: [{ log_id: `log-${ownerId}`, allowed }], error: null };
    }
    if (fn === "reconcile_ai_spend_for_owner") {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
  return { rpc };
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(claimLease).mockReset();
  vi.mocked(releaseLease).mockReset();
  vi.mocked(listOptedInOwnerIds).mockReset();
  vi.mocked(getOwnerSettings).mockReset();
  vi.mocked(getOwnerAccounts).mockReset();
  vi.mocked(getOwnerTradesForWindow).mockReset();
  vi.mocked(hasExistingReport).mockReset();
  vi.mocked(saveScheduledReport).mockReset();
  vi.mocked(interpretWeeklyReport).mockReset();

  vi.mocked(createServiceClient).mockReturnValue(mockServiceClient() as never);
  vi.mocked(claimLease).mockResolvedValue({ claimed: true, attemptCount: 1 });
  vi.mocked(releaseLease).mockResolvedValue(undefined);
  vi.mocked(listOptedInOwnerIds).mockResolvedValue([]);
  vi.mocked(hasExistingReport).mockResolvedValue(false);
  vi.mocked(saveScheduledReport).mockResolvedValue("inserted");
});

describe("GET /api/cron/weekly-reports — authentication", () => {
  it("returns 401 and never claims the lease without the correct CRON_SECRET", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(claimLease).not.toHaveBeenCalled();
  });

  it("returns 401 when no Authorization header is present at all", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(claimLease).not.toHaveBeenCalled();
  });

  it("proceeds past auth with the correct bearer token", async () => {
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(claimLease).toHaveBeenCalled();
  });
});

describe("GET /api/cron/weekly-reports — lease contention", () => {
  it("exits immediately without listing owners when the lease is already held", async () => {
    vi.mocked(claimLease).mockResolvedValue({ claimed: false, reason: "held" });
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.claimed).toBe(false);
    expect(json.reason).toBe("held");
    expect(listOptedInOwnerIds).not.toHaveBeenCalled();
    expect(releaseLease).not.toHaveBeenCalled();
  });

  it("exits immediately when the period is already completed", async () => {
    vi.mocked(claimLease).mockResolvedValue({ claimed: false, reason: "completed" });
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();
    expect(json.reason).toBe("completed");
    expect(listOptedInOwnerIds).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/weekly-reports — user isolation", () => {
  it("fetches each owner's data separately and never mixes one owner's trades into another's report", async () => {
    vi.mocked(listOptedInOwnerIds).mockResolvedValue(["owner-a", "owner-b"]);
    vi.mocked(getOwnerSettings).mockImplementation(async () => makeSettings());
    vi.mocked(getOwnerAccounts).mockImplementation(async (_s, ownerId: string) => [makeAccount({ id: `acc-${ownerId}` })]);
    vi.mocked(getOwnerTradesForWindow).mockImplementation(async (_s, ownerId: string) => [
      makeTrade({ id: `trade-${ownerId}`, accountId: `acc-${ownerId}`, realizedPnl: ownerId === "owner-a" ? 500 : -200 }),
    ]);
    vi.mocked(interpretWeeklyReport).mockResolvedValue({
      interpretation: { overview: "x", strengths: [], weaknesses: [], patterns: [], actionItems: [], evidenceNote: "x" } as never,
      usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    });

    await GET(makeRequest(`Bearer ${CRON_SECRET}`));

    expect(getOwnerTradesForWindow).toHaveBeenCalledTimes(2);
    const ownerIdsQueried = vi.mocked(getOwnerTradesForWindow).mock.calls.map((c) => c[1]);
    expect(ownerIdsQueried.sort()).toEqual(["owner-a", "owner-b"]);

    expect(saveScheduledReport).toHaveBeenCalledTimes(2);
    const savedOwnerIds = vi.mocked(saveScheduledReport).mock.calls.map((c) => c[1]);
    expect(savedOwnerIds.sort()).toEqual(["owner-a", "owner-b"]);

    // Each save call's snapshot must reflect only that owner's own trade.
    for (const call of vi.mocked(saveScheduledReport).mock.calls) {
      const [, ownerId, input] = call;
      const expectedPnl = ownerId === "owner-a" ? 500 : -200;
      expect(input.statsSnapshot.stats.netPnl).toBe(expectedPnl);
    }
  });
});

describe("GET /api/cron/weekly-reports — idempotency", () => {
  it("skips an owner who already has a report for the period, with no AI call", async () => {
    vi.mocked(listOptedInOwnerIds).mockResolvedValue(["owner-a"]);
    vi.mocked(hasExistingReport).mockResolvedValue(true);

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(json.skipped).toBe(1);
    expect(json.processed).toBe(0);
    expect(interpretWeeklyReport).not.toHaveBeenCalled();
    expect(saveScheduledReport).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/weekly-reports — empty weeks cost nothing", () => {
  it("saves a zero-trade report without any AI call or budget reservation", async () => {
    vi.mocked(listOptedInOwnerIds).mockResolvedValue(["owner-a"]);
    vi.mocked(getOwnerSettings).mockResolvedValue(makeSettings());
    vi.mocked(getOwnerAccounts).mockResolvedValue([makeAccount()]);
    vi.mocked(getOwnerTradesForWindow).mockResolvedValue([]);

    const client = mockServiceClient();
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(json.processed).toBe(1);
    expect(interpretWeeklyReport).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalledWith("reserve_ai_spend_for_owner", expect.anything());
    expect(saveScheduledReport).toHaveBeenCalledWith(
      expect.anything(),
      "owner-a",
      expect.objectContaining({ modelUsed: "none", tradesCount: 0 })
    );
  });
});

describe("GET /api/cron/weekly-reports — budget exhaustion", () => {
  it("stops gracefully (leaves remaining owners unprocessed) once the global budget is exhausted", async () => {
    vi.mocked(listOptedInOwnerIds).mockResolvedValue(["owner-a", "owner-b", "owner-c"]);
    vi.mocked(getOwnerSettings).mockResolvedValue(makeSettings());
    vi.mocked(getOwnerAccounts).mockResolvedValue([makeAccount()]);
    vi.mocked(getOwnerTradesForWindow).mockResolvedValue([makeTrade()]);
    vi.mocked(interpretWeeklyReport).mockResolvedValue({
      interpretation: { overview: "x", strengths: [], weaknesses: [], patterns: [], actionItems: [], evidenceNote: "x" } as never,
      usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    });

    // owner-a succeeds, owner-b gets rejected (budget exhausted) -> owner-c must never even be attempted.
    const client = mockServiceClient({ "owner-a": true, "owner-b": false });
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(json.processed).toBe(1);
    expect(json.budgetExhausted).toBe(true);
    expect(json.stoppedEarly).toBe(true);
    expect(json.status).toBe("running");
    expect(getOwnerTradesForWindow).not.toHaveBeenCalledWith(expect.anything(), "owner-c", expect.anything(), expect.anything());

    const releaseCall = vi.mocked(releaseLease).mock.calls[0];
    expect(releaseCall[3]).toMatchObject({ status: "running" });
  });
});

describe("GET /api/cron/weekly-reports — per-owner failure isolation", () => {
  it("counts one owner's AI failure without aborting the batch for the next owner", async () => {
    vi.mocked(listOptedInOwnerIds).mockResolvedValue(["owner-a", "owner-b"]);
    vi.mocked(getOwnerSettings).mockResolvedValue(makeSettings());
    vi.mocked(getOwnerAccounts).mockResolvedValue([makeAccount()]);
    vi.mocked(getOwnerTradesForWindow).mockResolvedValue([makeTrade()]);
    vi.mocked(interpretWeeklyReport)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        interpretation: { overview: "x", strengths: [], weaknesses: [], patterns: [], actionItems: [], evidenceNote: "x" } as never,
        usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
      });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const json = await res.json();

    expect(json.failed).toBe(1);
    expect(json.processed).toBe(1);
    expect(json.status).toBe("completed");
  });
});

describe("GET /api/cron/weekly-reports — report week uses each owner's own timezone", () => {
  it("computes week_start via getLocalWeekWindow(now, ownerTimezone, 1), not a shared UTC value", async () => {
    vi.mocked(listOptedInOwnerIds).mockResolvedValue(["owner-a"]);
    vi.mocked(getOwnerSettings).mockResolvedValue(makeSettings({ timezone: "Pacific/Kiritimati" })); // UTC+14, deliberately extreme
    vi.mocked(getOwnerAccounts).mockResolvedValue([makeAccount()]);
    vi.mocked(getOwnerTradesForWindow).mockResolvedValue([]);

    await GET(makeRequest(`Bearer ${CRON_SECRET}`));

    const [, ownerId, startISO] = vi.mocked(getOwnerTradesForWindow).mock.calls[0];
    expect(ownerId).toBe("owner-a");
    // Sanity: the window passed to getOwnerTradesForWindow should match
    // what getLocalWeekWindow itself produces for that extreme timezone.
    const expected = getLocalWeekWindow(new Date(), "Pacific/Kiritimati", 1);
    expect(startISO).toBe(expected.startISO);
  });
});
