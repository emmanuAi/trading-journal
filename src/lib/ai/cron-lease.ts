import type { SupabaseClient } from "@supabase/supabase-js";

export const WEEKLY_REPORTS_JOB_NAME = "weekly-reports";
export const LEASE_SECONDS = 360; // > Hobby's 300s maxDuration, so a genuinely still-running invocation's lease never gets stolen
export const MAX_ATTEMPTS = 5;

export type LeaseClaim =
  | { claimed: true; attemptCount: number }
  | { claimed: false; reason: "completed" | "failed" | "held" | "unknown" | "error" };

/** Atomically claims the lease for one period via the claim_cron_lease SQL
 * function (security definer — see the Phase 6 migration). This is the
 * mechanism that makes the batch resumable: a fresh period gets a clean
 * claim; a period whose previous attempt crashed/timed out (lease expired,
 * attempt ceiling not yet hit) gets reclaimed for another try; a period
 * that's already 'completed', already 'failed' (ceiling hit), or currently
 * held by a still-running invocation is correctly left alone. */
export async function claimLease(
  supabase: SupabaseClient,
  jobName: string,
  periodStart: string,
  leaseSeconds: number = LEASE_SECONDS,
  maxAttempts: number = MAX_ATTEMPTS
): Promise<LeaseClaim> {
  const { data, error } = await supabase.rpc("claim_cron_lease", {
    p_job_name: jobName,
    p_period_start: periodStart,
    p_lease_seconds: leaseSeconds,
    p_max_attempts: maxAttempts,
  });
  if (error) {
    return { claimed: false, reason: "error" };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.claimed) {
    return { claimed: true, attemptCount: row.attempt_count };
  }
  // The SQL function itself resolves a stale lease that's hit the attempt
  // ceiling to status='failed' before returning — so status='running' here
  // unambiguously means "actively held by another still-live invocation",
  // never "permanently exhausted". See the Phase 6 migration.
  if (row?.status === "completed" || row?.status === "failed") {
    return { claimed: false, reason: row.status };
  }
  if (row?.status === "running") {
    return { claimed: false, reason: "held" };
  }
  return { claimed: false, reason: "unknown" };
}

export interface ReleaseLeaseOutcome {
  /** 'running' means leave it claimable again — there's unfinished work
   * and the lease will simply expire, letting the next invocation resume.
   * Never set directly to 'failed' for "ran out of time"; that's still
   * 'running' (resumable). 'failed' is for the attempt-ceiling case only,
   * decided by the caller inspecting the claim's attemptCount. */
  status: "running" | "completed" | "failed";
  processed: number;
  skipped: number;
  failed: number;
}

export async function releaseLease(
  supabase: SupabaseClient,
  jobName: string,
  periodStart: string,
  outcome: ReleaseLeaseOutcome
): Promise<void> {
  await supabase.rpc("release_cron_lease", {
    p_job_name: jobName,
    p_period_start: periodStart,
    p_status: outcome.status,
    p_processed: outcome.processed,
    p_skipped: outcome.skipped,
    p_failed: outcome.failed,
  });
}
