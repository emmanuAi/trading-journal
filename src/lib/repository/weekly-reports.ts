import { createClient, requireUser } from "../supabase/server";
import type { WeeklySnapshot } from "../ai/weekly-snapshot";

export interface WeeklyReportRecord {
  id: string;
  accountId: string | null;
  weekStart: string;
  weekEnd: string;
  statsSnapshot: WeeklySnapshot;
  summaryText: string;
  modelUsed: string;
  tradesCount: number;
  createdAt: string;
}

interface ReportRow {
  id: string;
  account_id: string | null;
  week_start: string;
  week_end: string;
  stats_snapshot: WeeklySnapshot;
  summary_text: string;
  model_used: string;
  trades_count: number;
  created_at: string;
}

function rowToReport(row: ReportRow): WeeklyReportRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    statsSnapshot: row.stats_snapshot,
    summaryText: row.summary_text,
    modelUsed: row.model_used,
    tradesCount: row.trades_count,
    createdAt: row.created_at,
  };
}

/** The Postgres SQLSTATE for a unique-constraint violation — thrown by
 * insertReport() when two near-simultaneous first-time generations race
 * each other (see the reports route for how this is handled). */
export const UNIQUE_VIOLATION_CODE = "23505";

export async function listReports(): Promise<WeeklyReportRecord[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("ai_weekly_reports")
    .select("*")
    .eq("owner", user.id)
    .order("week_start", { ascending: false });
  if (error) throw error;
  return (data as ReportRow[]).map(rowToReport);
}

export async function getReportForWeek(accountId: string | null, weekStart: string): Promise<WeeklyReportRecord | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  let query = supabase.from("ai_weekly_reports").select("*").eq("owner", user.id).eq("week_start", weekStart);
  query = accountId === null ? query.is("account_id", null) : query.eq("account_id", accountId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? rowToReport(data as ReportRow) : null;
}

export interface ReportInput {
  accountId: string | null;
  weekStart: string;
  weekEnd: string;
  statsSnapshot: WeeklySnapshot;
  summaryText: string;
  modelUsed: string;
  tradesCount: number;
}

/** Plain insert — used only for a first-time generation (no existing report
 * for this owner/account/week). Throws with `code === UNIQUE_VIOLATION_CODE`
 * if another concurrent request won the race and already inserted one;
 * the caller re-fetches and serves that row instead of erroring out. */
export async function insertReport(input: ReportInput): Promise<WeeklyReportRecord> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("ai_weekly_reports")
    .insert({
      owner: user.id,
      account_id: input.accountId,
      week_start: input.weekStart,
      week_end: input.weekEnd,
      stats_snapshot: input.statsSnapshot,
      summary_text: input.summaryText,
      model_used: input.modelUsed,
      trades_count: input.tradesCount,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToReport(data as ReportRow);
}

/** Overwrites an existing report in place — used only for an explicit
 * regenerate action. Matches on owner/account_id/week_start, the same key
 * the unique constraint enforces. */
export async function regenerateReport(input: ReportInput): Promise<WeeklyReportRecord> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  let query = supabase
    .from("ai_weekly_reports")
    .update({
      stats_snapshot: input.statsSnapshot,
      summary_text: input.summaryText,
      model_used: input.modelUsed,
      trades_count: input.tradesCount,
      week_end: input.weekEnd,
    })
    .eq("owner", user.id)
    .eq("week_start", input.weekStart);
  query = input.accountId === null ? query.is("account_id", null) : query.eq("account_id", input.accountId);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return rowToReport(data as ReportRow);
}
