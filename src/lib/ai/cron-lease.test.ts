import { describe, it, expect, vi } from "vitest";
import { claimLease, releaseLease, WEEKLY_REPORTS_JOB_NAME } from "./cron-lease";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeClient(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc: vi.fn(rpcImpl) } as unknown as SupabaseClient;
}

describe("claimLease", () => {
  it("reports a fresh claim as claimed with attemptCount 1", async () => {
    const client = makeClient(async () => ({ data: [{ claimed: true, attempt_count: 1, status: "running" }], error: null }));
    const result = await claimLease(client, WEEKLY_REPORTS_JOB_NAME, "2026-10-26");
    expect(result).toEqual({ claimed: true, attemptCount: 1 });
  });

  it("reports a reclaimed stale lease as claimed with the incremented attemptCount", async () => {
    const client = makeClient(async () => ({ data: [{ claimed: true, attempt_count: 3, status: "running" }], error: null }));
    const result = await claimLease(client, WEEKLY_REPORTS_JOB_NAME, "2026-10-26");
    expect(result).toEqual({ claimed: true, attemptCount: 3 });
  });

  it("maps an actively-held lease (status running, claimed false) to reason 'held'", async () => {
    const client = makeClient(async () => ({ data: [{ claimed: false, attempt_count: 2, status: "running" }], error: null }));
    const result = await claimLease(client, WEEKLY_REPORTS_JOB_NAME, "2026-10-26");
    expect(result).toEqual({ claimed: false, reason: "held" });
  });

  it("maps a completed period to reason 'completed'", async () => {
    const client = makeClient(async () => ({ data: [{ claimed: false, attempt_count: 1, status: "completed" }], error: null }));
    const result = await claimLease(client, WEEKLY_REPORTS_JOB_NAME, "2026-10-26");
    expect(result).toEqual({ claimed: false, reason: "completed" });
  });

  it("maps a ceiling-exhausted period to reason 'failed'", async () => {
    const client = makeClient(async () => ({ data: [{ claimed: false, attempt_count: 5, status: "failed" }], error: null }));
    const result = await claimLease(client, WEEKLY_REPORTS_JOB_NAME, "2026-10-26");
    expect(result).toEqual({ claimed: false, reason: "failed" });
  });

  it("fails safe (not claimed) on an RPC error rather than throwing", async () => {
    const client = makeClient(async () => ({ data: null, error: { message: "db unreachable" } }));
    const result = await claimLease(client, WEEKLY_REPORTS_JOB_NAME, "2026-10-26");
    expect(result).toEqual({ claimed: false, reason: "error" });
  });

  it("passes the job name, period, lease seconds, and max attempts through to the RPC call", async () => {
    const rpc = vi.fn(async () => ({ data: [{ claimed: true, attempt_count: 1, status: "running" }], error: null }));
    const client = { rpc } as unknown as SupabaseClient;
    await claimLease(client, "weekly-reports", "2026-10-26", 360, 5);
    expect(rpc).toHaveBeenCalledWith("claim_cron_lease", {
      p_job_name: "weekly-reports",
      p_period_start: "2026-10-26",
      p_lease_seconds: 360,
      p_max_attempts: 5,
    });
  });
});

describe("releaseLease", () => {
  it("calls release_cron_lease with the exact outcome counts", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const client = { rpc } as unknown as SupabaseClient;
    await releaseLease(client, WEEKLY_REPORTS_JOB_NAME, "2026-10-26", { status: "completed", processed: 3, skipped: 2, failed: 1 });
    expect(rpc).toHaveBeenCalledWith("release_cron_lease", {
      p_job_name: WEEKLY_REPORTS_JOB_NAME,
      p_period_start: "2026-10-26",
      p_status: "completed",
      p_processed: 3,
      p_skipped: 2,
      p_failed: 1,
    });
  });
});
