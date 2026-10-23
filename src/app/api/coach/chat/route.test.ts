import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/repository/accounts", () => ({
  listAccounts: vi.fn(),
}));
vi.mock("@/lib/repository/coach", () => ({
  getConversation: vi.fn(),
  listRecentMessages: vi.fn(),
  createConversationWithTurn: vi.fn(),
  appendTurn: vi.fn(),
}));
vi.mock("@/lib/ai/coach-chat", () => ({
  runCoachChat: vi.fn(),
}));

import { createClient, requireUser } from "@/lib/supabase/server";
import { listAccounts } from "@/lib/repository/accounts";
import { getConversation, listRecentMessages, createConversationWithTurn, appendTurn } from "@/lib/repository/coach";
import { runCoachChat } from "@/lib/ai/coach-chat";
import { POST } from "./route";

const ACCOUNT = {
  id: "acc-1",
  name: "Personal",
  type: "personal" as const,
  baseCurrency: "EUR",
  startingBalance: 10000,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const REPLY = { reply: "Your win rate is 50%.", usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 } };

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

function makeSupabase(opts: {
  usageCount?: number;
  countError?: unknown;
  reserveAllowed?: boolean;
  reserveError?: unknown;
  reconcileError?: unknown;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- second param widens the mock's call-tuple type so `.mock.calls[n][1]` below type-checks.
  const rpc = vi.fn((fn: string, args?: Record<string, unknown>) => {
    if (fn === "reserve_ai_spend") {
      return Promise.resolve({ data: [{ log_id: "log-1", allowed: opts.reserveAllowed ?? true }], error: opts.reserveError ?? null });
    }
    if (fn === "reconcile_ai_spend") {
      return Promise.resolve({ data: null, error: opts.reconcileError ?? null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  return {
    from: vi.fn(() => makeQueryChain({ count: opts.usageCount ?? 0, error: opts.countError ?? null })),
    rpc,
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/coach/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(requireUser).mockReset();
  vi.mocked(listAccounts).mockReset();
  vi.mocked(runCoachChat).mockReset();
  vi.mocked(getConversation).mockReset();
  vi.mocked(listRecentMessages).mockReset();
  vi.mocked(createConversationWithTurn).mockReset();
  vi.mocked(appendTurn).mockReset();
  vi.mocked(listAccounts).mockResolvedValue([ACCOUNT]);
  vi.mocked(createConversationWithTurn).mockResolvedValue({ id: "conv-new", accountId: "acc-1", title: "t", createdAt: "x", updatedAt: "x" });
});

describe("POST /api/coach/chat — authentication", () => {
  it("returns 401 and never calls Claude when there is no authenticated user", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(requireUser).mockRejectedValue(new Error("Not authenticated."));

    const res = await POST(makeRequest({ message: "hi", accountId: "acc-1" }));
    expect(res.status).toBe(401);
    expect(runCoachChat).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/chat — account isolation", () => {
  it("returns 400 and never calls Claude for an accountId the user does not own", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);

    const res = await POST(makeRequest({ message: "hi", accountId: "someone-elses-account" }));
    expect(res.status).toBe(400);
    expect(runCoachChat).not.toHaveBeenCalled();
  });

  it("proceeds when the accountId belongs to the user, and starts a new persisted conversation", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(runCoachChat).mockResolvedValue(REPLY);

    const res = await POST(makeRequest({ message: "what is my win rate?", accountId: "acc-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe("Your win rate is 50%.");
    expect(json.conversationId).toBe("conv-new");
    expect(createConversationWithTurn).toHaveBeenCalledWith("acc-1", expect.any(String), "what is my win rate?", "Your win rate is 50%.");
    expect(appendTurn).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/chat — conversation isolation", () => {
  it("returns 400 and never calls Claude for a conversationId the user does not own", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(getConversation).mockResolvedValue(null);

    const res = await POST(makeRequest({ message: "hi", accountId: "acc-1", conversationId: "someone-elses-conversation" }));
    expect(res.status).toBe(400);
    expect(runCoachChat).not.toHaveBeenCalled();
  });

  it("loads prior history and appends to the existing conversation on success", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(getConversation).mockResolvedValue({ id: "conv-1", accountId: "acc-1", title: "t", createdAt: "x", updatedAt: "x" });
    vi.mocked(listRecentMessages).mockResolvedValue([
      { id: "m1", conversationId: "conv-1", role: "user", content: "earlier question", createdAt: "x" },
      { id: "m2", conversationId: "conv-1", role: "assistant", content: "earlier answer", createdAt: "x" },
    ]);
    vi.mocked(runCoachChat).mockResolvedValue(REPLY);

    const res = await POST(makeRequest({ message: "follow up", accountId: "acc-1", conversationId: "conv-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversationId).toBe("conv-1");

    expect(runCoachChat).toHaveBeenCalledWith(
      "follow up",
      expect.anything(),
      [
        { role: "user", content: "earlier question" },
        { role: "assistant", content: "earlier answer" },
      ]
    );
    expect(appendTurn).toHaveBeenCalledWith("conv-1", "follow up", "Your win rate is 50%.");
    expect(createConversationWithTurn).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/chat — budget controls", () => {
  it("returns 402 and never calls Claude when the monthly budget is exhausted", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ reserveAllowed: false }) as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);

    const res = await POST(makeRequest({ message: "hi", accountId: "acc-1" }));
    expect(res.status).toBe(402);
    expect(runCoachChat).not.toHaveBeenCalled();
  });

  it("returns 429 and never calls Claude when the daily rate limit is already hit", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ usageCount: 50 }) as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);

    const res = await POST(makeRequest({ message: "hi", accountId: "acc-1" }));
    expect(res.status).toBe(429);
    expect(runCoachChat).not.toHaveBeenCalled();
  });
});

describe("POST /api/coach/chat — error handling", () => {
  it("returns a safe 500, still reconciles (actual=0), and persists nothing when the AI call throws", async () => {
    const supabase = makeSupabase({});
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(runCoachChat).mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest({ message: "hi", accountId: "acc-1" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeTruthy();

    const reconcileCall = supabase.rpc.mock.calls.find((c) => c[0] === "reconcile_ai_spend");
    expect(reconcileCall?.[1]).toMatchObject({ p_log_id: "log-1", p_actual_usd: 0 });
    expect(createConversationWithTurn).not.toHaveBeenCalled();
    expect(appendTurn).not.toHaveBeenCalled();
  });

  it("rejects an invalid request body before touching the database", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase({}) as never);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);

    const res = await POST(makeRequest({ message: "" }));
    expect(res.status).toBe(400);
    expect(listAccounts).not.toHaveBeenCalled();
  });
});
