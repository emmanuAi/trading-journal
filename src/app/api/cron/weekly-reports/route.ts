import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { claimLease, releaseLease, WEEKLY_REPORTS_JOB_NAME } from "@/lib/ai/cron-lease";
import {
  listOptedInOwnerIds,
  getOwnerSettings,
  getOwnerAccounts,
  getOwnerTradesForWindow,
  hasExistingReport,
  saveScheduledReport,
} from "@/lib/repository/cron-reports";
import { getLocalWeekWindow, buildWeeklySnapshot } from "@/lib/ai/weekly-snapshot";
import { interpretWeeklyReport, REPORT_MAX_OUTPUT_TOKENS } from "@/lib/ai/weekly-report";
import { COACH_MODEL } from "@/lib/ai/client";
import { estimateCallCostUsd, estimateTokensFromText, computeActualCostUsd } from "@/lib/ai/pricing";

// Hobby's hard ceiling is 300s; stop a bit earlier so there's always time
// left to release the lease cleanly instead of being hard-killed mid-flight.
export const maxDuration = 290;

const SOFT_TIME_BUDGET_MS = 240_000;
const MAX_OWNERS_PER_RUN = 30;
const RESERVE_CAP_USD = 1.0; // matches the DB function's own per-call ceiling
const NO_TRADES_SUMMARY = JSON.stringify({ empty: true, message: "No trades were recorded for this week." });

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const startedAt = Date.now();
  const supabase = createServiceClient();

  // The lock's own bookkeeping period, anchored to UTC per decision 1 of
  // the plan — distinct from each individual owner's report week_start,
  // which is always computed in THEIR OWN timezone below. This is just a
  // stable key for "which week's batch is this daily run advancing."
  const now = new Date();
  const periodStart = getLocalWeekWindow(now, "UTC", 1).weekStart;

  const claim = await claimLease(supabase, WEEKLY_REPORTS_JOB_NAME, periodStart);
  if (!claim.claimed) {
    // Not an error: a 'completed' or 'held' period is the expected steady
    // state on most days (reports are only generated once a week; this
    // daily check is what makes an interrupted run resumable, not a
    // promise that there's new work every day).
    return NextResponse.json({ periodStart, claimed: false, reason: claim.reason });
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let budgetExhausted = false;
  let stoppedEarly = false;

  try {
    const ownerIds = await listOptedInOwnerIds(supabase);

    for (let i = 0; i < ownerIds.length; i++) {
      if (i >= MAX_OWNERS_PER_RUN || Date.now() - startedAt > SOFT_TIME_BUDGET_MS) {
        stoppedEarly = true;
        break;
      }
      if (budgetExhausted) {
        stoppedEarly = true;
        break;
      }

      const ownerId = ownerIds[i];
      try {
        const settings = await getOwnerSettings(supabase, ownerId);
        if (!settings) {
          skipped++;
          continue;
        }

        const window = getLocalWeekWindow(now, settings.timezone, 1);

        // Idempotency guard: never auto-regenerate an existing report —
        // this is the "done" signal for this owner+week, whether that row
        // came from a prior cron attempt, a prior successful save in this
        // same invocation's resume, or the user generating it manually in
        // the UI in the meantime.
        if (await hasExistingReport(supabase, ownerId, window.weekStart)) {
          skipped++;
          continue;
        }

        const accounts = await getOwnerAccounts(supabase, ownerId);
        if (accounts.length === 0) {
          skipped++;
          continue;
        }

        const inclusiveDateTo = new Date(new Date(window.endISO).getTime() - 1).toISOString();
        const weekTrades = await getOwnerTradesForWindow(supabase, ownerId, window.startISO, inclusiveDateTo);
        const startingBalance = accounts.reduce((sum, a) => sum + a.startingBalance, 0);
        const snapshot = buildWeeklySnapshot(window, weekTrades, startingBalance, "EUR");

        let summaryText: string;
        let modelUsed: string;

        if (!snapshot.hasTrades) {
          // Skip empty weeks without spending AI tokens — same rule as
          // Phase 5's on-demand path, reused exactly.
          summaryText = NO_TRADES_SUMMARY;
          modelUsed = "none";
        } else {
          const estimatedInputTokens = estimateTokensFromText(JSON.stringify(snapshot)) + weekTrades.length * 60 + 1500;
          const estimatedCost = Math.min(estimateCallCostUsd(COACH_MODEL, estimatedInputTokens, REPORT_MAX_OUTPUT_TOKENS), RESERVE_CAP_USD);

          const { data: reserveRows, error: reserveError } = await supabase.rpc("reserve_ai_spend_for_owner", {
            p_owner: ownerId,
            p_kind: "weekly_report",
            p_estimated_usd: estimatedCost,
          });
          if (reserveError) {
            failed++;
            console.error("[cron/weekly-reports] budget reservation failed for owner", ownerId, ":", reserveError.message);
            continue;
          }
          const reservation = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;
          if (!reservation?.allowed) {
            // Stop gracefully: the global budget is exhausted. This owner
            // and anyone after them in the list stay unprocessed, to be
            // retried once budget is available again (next invocation,
            // including after next month's reset). stoppedEarly must be
            // set HERE, not left to the loop's top-of-iteration guard —
            // that guard never runs again once this `break` fires.
            budgetExhausted = true;
            stoppedEarly = true;
            break;
          }
          const logId = reservation.log_id as string;

          async function reconcile(actualUsd: number) {
            try {
              await supabase.rpc("reconcile_ai_spend_for_owner", {
                p_owner: ownerId,
                p_log_id: logId,
                p_actual_usd: Math.min(Math.max(actualUsd, 0), RESERVE_CAP_USD),
              });
            } catch (err) {
              console.error("[cron/weekly-reports] reconcile failed for owner", ownerId, ":", err instanceof Error ? err.message : err);
            }
          }

          try {
            const result = await interpretWeeklyReport(snapshot, weekTrades);
            const actualCost = computeActualCostUsd(COACH_MODEL, {
              input_tokens: result.usage.inputTokens,
              output_tokens: result.usage.outputTokens,
              cache_creation_input_tokens: result.usage.cacheCreationInputTokens,
              cache_read_input_tokens: result.usage.cacheReadInputTokens,
            });
            await reconcile(actualCost);
            summaryText = JSON.stringify(result.interpretation);
            modelUsed = COACH_MODEL;
          } catch (err) {
            await reconcile(0);
            failed++;
            const reason = err instanceof Anthropic.APIError ? `Anthropic API error (${err.status})` : "unknown error";
            console.error("[cron/weekly-reports] generation failed for owner", ownerId, ":", reason);
            continue;
          }
        }

        await saveScheduledReport(supabase, ownerId, {
          accountId: null,
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          statsSnapshot: snapshot,
          summaryText,
          modelUsed,
          tradesCount: snapshot.tradesCount,
        });
        processed++;
      } catch (err) {
        // One owner's unexpected failure must never abort the whole batch
        // or leak into another owner's processing.
        failed++;
        console.error("[cron/weekly-reports] unexpected error for owner", ownerId, ":", err instanceof Error ? err.message : "unknown error");
      }
    }
  } catch (err) {
    console.error("[cron/weekly-reports] batch-level failure:", err instanceof Error ? err.message : "unknown error");
    await releaseLease(supabase, WEEKLY_REPORTS_JOB_NAME, periodStart, { status: "running", processed, skipped, failed });
    return NextResponse.json({ periodStart, claimed: true, processed, skipped, failed, error: "batch-level failure, left resumable" }, { status: 500 });
  }

  // Always release as 'running' when there's unfinished work — never decide
  // 'failed' here. The attempt ceiling is enforced entirely by
  // claim_cron_lease itself on the *next* claim attempt (see the Phase 6
  // migration), so there's exactly one place that logic lives.
  const finalStatus = stoppedEarly ? "running" : "completed";

  await releaseLease(supabase, WEEKLY_REPORTS_JOB_NAME, periodStart, { status: finalStatus, processed, skipped, failed });

  return NextResponse.json({
    periodStart,
    claimed: true,
    attemptCount: claim.attemptCount,
    processed,
    skipped,
    failed,
    stoppedEarly,
    budgetExhausted,
    status: finalStatus,
  });
}
