import { createClient, requireUser } from "../supabase/server";
import type { WeeklyReview, MonthlyReview, MistakeEntry } from "../types";

interface WeeklyReviewRow {
  id: string;
  week_start: string;
  wins: string;
  mistakes: string;
  lessons: string;
  goal_for_next_week: string;
  created_at: string;
}

interface MonthlyReviewRow {
  id: string;
  month_start: string;
  summary: string;
  lessons: string;
  goal_for_next_month: string;
  created_at: string;
}

interface MistakeRow {
  id: string;
  title: string;
  description: string;
  related_trade_id: string | null;
  tag: string;
  created_at: string;
}

function rowToWeeklyReview(r: WeeklyReviewRow): WeeklyReview {
  return {
    id: r.id,
    weekStart: r.week_start,
    wins: r.wins,
    mistakes: r.mistakes,
    lessons: r.lessons,
    goalForNextWeek: r.goal_for_next_week,
    createdAt: r.created_at,
  };
}

function rowToMonthlyReview(r: MonthlyReviewRow): MonthlyReview {
  return {
    id: r.id,
    monthStart: r.month_start,
    summary: r.summary,
    lessons: r.lessons,
    goalForNextMonth: r.goal_for_next_month,
    createdAt: r.created_at,
  };
}

function rowToMistake(r: MistakeRow): MistakeEntry {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    relatedTradeId: r.related_trade_id,
    tag: r.tag,
    createdAt: r.created_at,
  };
}

export async function listWeeklyReviews(): Promise<WeeklyReview[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("owner", user.id)
    .order("week_start", { ascending: false });
  if (error) throw error;
  return (data as WeeklyReviewRow[]).map(rowToWeeklyReview);
}

export async function createWeeklyReview(input: Omit<WeeklyReview, "id" | "createdAt">): Promise<WeeklyReview> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("weekly_reviews")
    .insert({
      owner: user.id,
      week_start: input.weekStart,
      wins: input.wins,
      mistakes: input.mistakes,
      lessons: input.lessons,
      goal_for_next_week: input.goalForNextWeek,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToWeeklyReview(data as WeeklyReviewRow);
}

export async function deleteWeeklyReview(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase.from("weekly_reviews").delete().eq("id", id).eq("owner", user.id);
  if (error) throw error;
}

export async function listMonthlyReviews(): Promise<MonthlyReview[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("monthly_reviews")
    .select("*")
    .eq("owner", user.id)
    .order("month_start", { ascending: false });
  if (error) throw error;
  return (data as MonthlyReviewRow[]).map(rowToMonthlyReview);
}

export async function createMonthlyReview(input: Omit<MonthlyReview, "id" | "createdAt">): Promise<MonthlyReview> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("monthly_reviews")
    .insert({
      owner: user.id,
      month_start: input.monthStart,
      summary: input.summary,
      lessons: input.lessons,
      goal_for_next_month: input.goalForNextMonth,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToMonthlyReview(data as MonthlyReviewRow);
}

export async function deleteMonthlyReview(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase.from("monthly_reviews").delete().eq("id", id).eq("owner", user.id);
  if (error) throw error;
}

export async function listMistakes(): Promise<MistakeEntry[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("mistakes")
    .select("*")
    .eq("owner", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as MistakeRow[]).map(rowToMistake);
}

export async function createMistake(input: Omit<MistakeEntry, "id" | "createdAt">): Promise<MistakeEntry> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("mistakes")
    .insert({
      owner: user.id,
      title: input.title,
      description: input.description,
      related_trade_id: input.relatedTradeId,
      tag: input.tag,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToMistake(data as MistakeRow);
}

export async function deleteMistake(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase.from("mistakes").delete().eq("id", id).eq("owner", user.id);
  if (error) throw error;
}
