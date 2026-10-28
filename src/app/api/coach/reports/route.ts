import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { listAccounts } from "@/lib/repository/accounts";
import { listTrades } from "@/lib/repository/trades";
import { getSettings } from "@/lib/repository/settings";
import {
  listReports,
  getReportForWeek,
  insertReport,
  regenerateReport,
  UNIQUE_VIOLATION_CODE,
  type WeeklyReportRecord,
} from "@/lib/repository/weekly-reports";
import { validateGenerateReportRequest, resolveAndValidateWeek } from "@/lib/ai/report-request";
import { resolveAccountScope } from "@/lib/ai/scope";
import { buildWeeklySnapshot } from "@/lib/ai/weekly-snapshot";
import { interpretWeeklyReport, REPORT_MAX_OUTPUT_TOKENS } from "@/lib/ai/weekly-report";
import { COACH_MODEL } from "@/lib/ai/client";
import { estimateCallCostUsd, estimateTokensFromText, computeActualCostUsd } from "@/lib/ai/pricing";

const DAILY_REPORT_LIMIT = 10;
const RESERVE_CAP_USD = 1.0; // matches the DB function's own per-call ceiling
const NO_TRADES_SUMMARY = JSON.stringify({ empty: true, message: "No trades were recorded for this week." });

export async function GET() {
  return NextResponse.json({ reports: await listReports() });
}

export async function POST(req: Request) {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireUser(supabase);
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateGenerateReportRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Account isolation: identical principle to /api/coach/chat — resolved
  // only from this user's own accounts list, never trusting a client id.
  const accounts = await listAccounts();
  const scopeResult = resolveAccountScope(accounts, validation.body);
  if (!scopeResult.ok) {
    return NextResponse.json({ error: scopeResult.error }, { status: 400 });
  }
  const scope = scopeResult.scope;

  const settings = await getSettings();
  const weekResult = resolveAndValidateWeek(validation.body.weekStart, settings.timezone);
  if (!weekResult.ok) {
    return NextResponse.json({ error: weekResult.error }, { status: 400 });
  }
  const window = weekResult.window;

  // Avoid unnecessary API spending: a plain "generate" click on a week that
  // already has a report just serves the cached row — zero AI calls, zero
  // budget reservation, zero rate-limit cost. Only an explicit `regenerate`
  // flag forces a fresh call. This is also the first (non-atomic) half of
  // the duplicate-click guard; the insert-race fallback below closes the gap.
  const existing = await getReportForWeek(scope.accountId, window.weekStart);
  if (existing && !validation.body.regenerate) {
    return NextResponse.json({ report: existing, cached: true });
  }

  // Rate limit (regenerations and fresh generations share this cap —
  // ai_weekly_reports/ai_usage_log have no column to distinguish the two
  // without a schema change, which this phase doesn't make).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("owner", userId)
    .eq("kind", "weekly_report")
    .neq("status", "rejected")
    .gte("created_at", since);
  if (countError) {
    console.error("[coach/reports] rate limit check failed:", countError.message);
    return NextResponse.json({ error: "Report generation is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if ((count ?? 0) >= DAILY_REPORT_LIMIT) {
    return NextResponse.json({ error: "Daily report generation limit reached. Please try again tomorrow." }, { status: 429 });
  }

  // window.endISO is an exclusive upper bound (the instant the *next* week
  // starts), but listTrades' dateTo filter is inclusive (`<=`) — subtract
  // 1ms so a trade closing exactly at that boundary instant isn't double-
  // counted into the following week too.
  const inclusiveDateTo = new Date(new Date(window.endISO).getTime() - 1).toISOString();
  const weekTrades = await listTrades({
    accountId: scope.accountId ?? undefined,
    includeDemo: false,
    dateFrom: window.startISO,
    dateTo: inclusiveDateTo,
  });

  const startingBalance = accounts.filter((a) => scope.accountIds.includes(a.id)).reduce((sum, a) => sum + a.startingBalance, 0);
  const currency = scope.aggregated ? "EUR" : accounts.find((a) => a.id === scope.accountId)?.baseCurrency ?? "EUR";
  const snapshot = buildWeeklySnapshot(window, weekTrades, startingBalance, currency);

  let summaryText: string;
  let modelUsed: string;

  if (!snapshot.hasTrades) {
    // Clear empty state, zero AI spend — no reservation is made at all.
    summaryText = NO_TRADES_SUMMARY;
    modelUsed = "none";
  } else {
    const estimatedInputTokens = estimateTokensFromText(JSON.stringify(snapshot)) + weekTrades.length * 60 + 1500;
    const estimatedCost = Math.min(estimateCallCostUsd(COACH_MODEL, estimatedInputTokens, REPORT_MAX_OUTPUT_TOKENS), RESERVE_CAP_USD);

    const { data: reserveRows, error: reserveError } = await supabase.rpc("reserve_ai_spend", {
      p_kind: "weekly_report",
      p_estimated_usd: estimatedCost,
    });
    if (reserveError) {
      console.error("[coach/reports] budget reservation failed:", reserveError.message);
      return NextResponse.json({ error: "Report generation is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
    const reservation = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;
    if (!reservation?.allowed) {
      return NextResponse.json({ error: "This month's AI coach budget has been reached. Please try again next month." }, { status: 402 });
    }
    const logId = reservation.log_id as string;

    async function reconcile(actualUsd: number) {
      try {
        await supabase.rpc("reconcile_ai_spend", { p_log_id: logId, p_actual_usd: Math.min(Math.max(actualUsd, 0), RESERVE_CAP_USD) });
      } catch (err) {
        console.error("[coach/reports] reconcile failed:", err instanceof Error ? err.message : err);
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
      console.error("[coach/reports] Anthropic call failed:", err instanceof Error ? err.message : "unknown error");

      if (err instanceof Anthropic.RateLimitError) {
        return NextResponse.json({ error: "The AI coach is receiving too many requests right now. Please try again shortly." }, { status: 503 });
      }
      if (err instanceof Anthropic.APIError) {
        return NextResponse.json({ error: "Report generation is temporarily unavailable. Please try again shortly." }, { status: 503 });
      }
      return NextResponse.json({ error: "Something went wrong generating that report. Please try again." }, { status: 500 });
    }
  }

  const input = {
    accountId: scope.accountId,
    weekStart: window.weekStart,
    weekEnd: window.weekEnd,
    statsSnapshot: snapshot,
    summaryText,
    modelUsed,
    tradesCount: snapshot.tradesCount,
  };

  let report: WeeklyReportRecord;
  try {
    report = validation.body.regenerate && existing ? await regenerateReport(input) : await insertReport(input);
  } catch (err) {
    // Race: a concurrent first-time request for the same week won the
    // insert first. Serve what it wrote instead of erroring out — the
    // snapshot is deterministic, so the two attempts' numbers agree even
    // though the AI prose may differ trivially between them.
    if (err && typeof err === "object" && "code" in err && err.code === UNIQUE_VIOLATION_CODE) {
      const winner = await getReportForWeek(scope.accountId, window.weekStart);
      if (winner) return NextResponse.json({ report: winner, cached: true });
    }
    console.error("[coach/reports] save failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "The report was generated but could not be saved. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ report, cached: false });
}
