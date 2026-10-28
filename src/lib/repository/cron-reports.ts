import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Settings, Trade } from "@/lib/types";
import { rowToAccount, type AccountRow } from "./accounts";
import { rowToSettings, type SettingsRow } from "./settings";
import { rowToTrade, type TradeRow } from "./trades";
import { UNIQUE_VIOLATION_CODE, type ReportInput } from "./weekly-reports";

// Service-role data access for the Phase 6 cron job only. Every function
// here takes the service-role client and an explicit ownerId, and filters
// by it by hand — unlike every other repository file in this app, RLS is
// not doing that for us here, so getting the .eq("owner", ownerId) right
// on every query is the actual security boundary. Row-shape mapping is
// imported from the existing session-based repository files (zero
// duplicated mapping logic); only the query construction (no session, no
// RLS) is specific to this file.

export async function listOptedInOwnerIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("settings").select("owner").eq("auto_weekly_reports_enabled", true);
  if (error) throw error;
  return (data as { owner: string }[]).map((r) => r.owner);
}

export async function getOwnerSettings(supabase: SupabaseClient, ownerId: string): Promise<Settings | null> {
  const { data, error } = await supabase.from("settings").select("*").eq("owner", ownerId).maybeSingle();
  if (error) throw error;
  return data ? rowToSettings(data as SettingsRow) : null;
}

export async function getOwnerAccounts(supabase: SupabaseClient, ownerId: string): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select("*").eq("owner", ownerId);
  if (error) throw error;
  return (data as AccountRow[]).map(rowToAccount);
}

/** Trades for one owner within [startISO, endISOInclusive] — mirrors
 * listTrades()'s own exit-time-or-entry-time boundary filter exactly (see
 * src/lib/repository/trades.ts): fetched without a date prefilter at the
 * DB level (a trade can start before the window and still close inside
 * it), then filtered in-memory on (exit_time ?? entry_time), same as every
 * other date-ranged trade query in this app. Excludes demo trades,
 * matching every other AI-facing data path. */
export async function getOwnerTradesForWindow(supabase: SupabaseClient, ownerId: string, startISO: string, endISOInclusive: string): Promise<Trade[]> {
  const { data, error } = await supabase.from("trades").select("*").eq("owner", ownerId).eq("is_demo", false);
  if (error) throw error;

  const rows = (data as TradeRow[]).filter((r) => {
    const boundary = r.exit_time ?? r.entry_time;
    return boundary >= startISO && boundary <= endISOInclusive;
  });
  return rows.map(rowToTrade);
}

export async function hasExistingReport(supabase: SupabaseClient, ownerId: string, weekStart: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("ai_weekly_reports")
    .select("id")
    .eq("owner", ownerId)
    .is("account_id", null)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export type SaveScheduledReportResult = "inserted" | "already-exists";

/** Always inserts with account_id = null (the aggregated-only design for
 * automated reports) and source = 'scheduled'. A unique-violation here
 * means another path (a concurrent cron attempt, or the user manually
 * generating the same week at the same moment via Phase 5's UI) already
 * created this exact row — treated as success, not an error, since the
 * desired end state (a report exists for this owner/week) is already true. */
export async function saveScheduledReport(supabase: SupabaseClient, ownerId: string, input: ReportInput): Promise<SaveScheduledReportResult> {
  const { error } = await supabase.from("ai_weekly_reports").insert({
    owner: ownerId,
    account_id: input.accountId,
    week_start: input.weekStart,
    week_end: input.weekEnd,
    stats_snapshot: input.statsSnapshot,
    summary_text: input.summaryText,
    model_used: input.modelUsed,
    trades_count: input.tradesCount,
    source: "scheduled",
  });
  if (error) {
    if ("code" in error && error.code === UNIQUE_VIOLATION_CODE) {
      return "already-exists";
    }
    throw error;
  }
  return "inserted";
}
