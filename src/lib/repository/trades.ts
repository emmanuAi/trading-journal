import { createClient, requireUser } from "../supabase/server";
import {
  calcPlannedRR,
  calcGrossPnl,
  calcNetPnl,
  calcRiskAmount,
  calcActualR,
  determineResult,
} from "../calculations";
import type {
  Trade,
  Direction,
  TradeStatus,
  TradeResult,
  SetupGrade,
  PreTradeNotes,
  DuringTradeNotes,
  PostTradeNotes,
} from "../types";
import { listScreenshotsForTrade, listScreenshotsForTrades } from "./screenshots";
import { getAccount } from "./accounts";

export interface TradeRow {
  id: string;
  account_id: string;
  is_demo: boolean;
  instrument: string;
  direction: string;
  entry_time: string;
  exit_time: string | null;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  position_size: number;
  account_balance_at_entry: number;
  risk_percent: number | null;
  risk_amount: number | null;
  fees: number;
  commission: number;
  swap: number;
  status: string;
  result: string | null;
  realized_pnl: number | null;
  planned_rr: number | null;
  actual_r: number | null;
  max_drawdown_pips: number | null;
  strategy: string | null;
  setup_grade: string | null;
  followed_plan: boolean;
  emotion_tags: string[];
  custom_tags: string[];
  pre_trade: PreTradeNotes;
  during_trade: DuringTradeNotes;
  post_trade: PostTradeNotes;
  created_at: string;
  updated_at: string;
}

export function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    accountId: row.account_id,
    isDemo: row.is_demo,
    instrument: row.instrument,
    direction: row.direction as Direction,
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    entryPrice: row.entry_price,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    exitPrice: row.exit_price,
    positionSize: row.position_size,
    accountBalanceAtEntry: row.account_balance_at_entry,
    riskPercent: row.risk_percent,
    riskAmount: row.risk_amount,
    fees: row.fees,
    commission: row.commission,
    swap: row.swap,
    status: row.status as TradeStatus,
    result: row.result as TradeResult,
    realizedPnl: row.realized_pnl,
    plannedRR: row.planned_rr,
    actualR: row.actual_r,
    maxDrawdownPips: row.max_drawdown_pips,
    strategy: row.strategy,
    setupGrade: row.setup_grade as SetupGrade,
    followedPlan: row.followed_plan,
    emotionTags: row.emotion_tags ?? [],
    customTags: row.custom_tags ?? [],
    preTrade: row.pre_trade,
    duringTrade: row.during_trade,
    postTrade: row.post_trade,
    screenshots: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface TradeInput {
  accountId: string;
  isDemo?: boolean;
  instrument: string;
  direction: Direction;
  entryTime: string;
  exitTime?: string | null;
  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  exitPrice?: number | null;
  positionSize: number;
  accountBalanceAtEntry: number;
  riskPercent?: number | null;
  riskAmount?: number | null;
  fees?: number;
  commission?: number;
  swap?: number;
  status: TradeStatus;
  result?: TradeResult;
  realizedPnl?: number | null;
  plannedRR?: number | null;
  actualR?: number | null;
  maxDrawdownPips?: number | null;
  strategy?: string | null;
  setupGrade?: SetupGrade;
  followedPlan?: boolean;
  emotionTags?: string[];
  customTags?: string[];
  preTrade?: Partial<PreTradeNotes>;
  duringTrade?: Partial<DuringTradeNotes>;
  postTrade?: Partial<PostTradeNotes>;
}

const emptyPreTrade: PreTradeNotes = { entryReason: "", fundamentalBias: "", technicalConfirmation: "", thesis: "", invalidation: "" };
const emptyDuringTrade: DuringTradeNotes = { feelings: "", followedPlan: true, movedStopLoss: false, emotions: [] };
const emptyPostTrade: PostTradeNotes = { wentWell: "", wentWrong: "", lessonLearned: "", wouldRepeat: null, improvement: "" };

/** Fills in auto-calculated fields unless the caller explicitly provided an override. */
function deriveFields(input: TradeInput) {
  const plannedRR =
    input.plannedRR !== undefined && input.plannedRR !== null
      ? input.plannedRR
      : calcPlannedRR(input.entryPrice, input.stopLoss ?? null, input.takeProfit ?? null);

  const riskAmount =
    input.riskAmount !== undefined && input.riskAmount !== null
      ? input.riskAmount
      : calcRiskAmount(input.accountBalanceAtEntry, input.riskPercent ?? null);

  let realizedPnl = input.realizedPnl ?? null;
  if ((realizedPnl === null || realizedPnl === undefined) && input.exitPrice != null && input.status !== "open") {
    const gross = calcGrossPnl(input.entryPrice, input.exitPrice, input.positionSize, input.direction);
    realizedPnl = calcNetPnl(gross, input.fees ?? 0, input.commission ?? 0, input.swap ?? 0);
  }

  const actualR =
    input.actualR !== undefined && input.actualR !== null ? input.actualR : calcActualR(realizedPnl, riskAmount);

  let result = input.result ?? null;
  if (!result && input.status === "closed") {
    result = determineResult(realizedPnl);
  }

  return { plannedRR, riskAmount, realizedPnl, actualR, result };
}

function toRow(id: string, owner: string, input: TradeInput, derived: ReturnType<typeof deriveFields>, createdAt: string, updatedAt: string) {
  return {
    id,
    owner,
    account_id: input.accountId,
    is_demo: !!input.isDemo,
    instrument: input.instrument,
    direction: input.direction,
    entry_time: input.entryTime,
    exit_time: input.exitTime ?? null,
    entry_price: input.entryPrice,
    stop_loss: input.stopLoss ?? null,
    take_profit: input.takeProfit ?? null,
    exit_price: input.exitPrice ?? null,
    position_size: input.positionSize,
    account_balance_at_entry: input.accountBalanceAtEntry,
    risk_percent: input.riskPercent ?? null,
    risk_amount: derived.riskAmount,
    fees: input.fees ?? 0,
    commission: input.commission ?? 0,
    swap: input.swap ?? 0,
    status: input.status,
    result: derived.result,
    realized_pnl: derived.realizedPnl,
    planned_rr: derived.plannedRR,
    actual_r: derived.actualR,
    max_drawdown_pips: input.maxDrawdownPips ?? null,
    strategy: input.strategy ?? null,
    setup_grade: input.setupGrade ?? null,
    followed_plan: input.followedPlan !== false,
    emotion_tags: input.emotionTags ?? [],
    custom_tags: input.customTags ?? [],
    pre_trade: { ...emptyPreTrade, ...input.preTrade },
    during_trade: { ...emptyDuringTrade, ...input.duringTrade },
    post_trade: { ...emptyPostTrade, ...input.postTrade },
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export async function createTrade(input: TradeInput): Promise<Trade> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  // accountId is client-supplied; the accounts FK alone doesn't prove it's
  // *this* caller's account (any existing account id would satisfy it), and
  // account ids are UUIDs so this isn't realistically guessable — but verify
  // explicitly rather than lean on that. getAccount() is itself owner-scoped.
  if (!(await getAccount(input.accountId))) {
    throw new Error("Account not found.");
  }

  const { data: idData, error: idError } = await supabase.rpc("next_trade_id");
  if (idError) throw idError;
  const id = idData as string;

  const now = new Date().toISOString();
  const derived = deriveFields(input);
  const row = toRow(id, user.id, input, derived, now, now);

  const { error } = await supabase.from("trades").insert(row);
  if (error) throw error;

  return (await getTrade(id))!;
}

export async function updateTrade(id: string, input: TradeInput): Promise<Trade | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: existing, error: existingError } = await supabase
    .from("trades")
    .select("id")
    .eq("id", id)
    .eq("owner", user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return null;

  if (!(await getAccount(input.accountId))) {
    throw new Error("Account not found.");
  }

  const now = new Date().toISOString();
  const derived = deriveFields(input);
  const row = toRow(id, user.id, input, derived, now, now);
  delete (row as { created_at?: string }).created_at;

  const { error } = await supabase.from("trades").update(row).eq("id", id).eq("owner", user.id);
  if (error) throw error;

  return getTrade(id);
}

export async function deleteTrade(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase.from("trades").delete().eq("id", id).eq("owner", user.id);
  if (error) throw error;
}

export async function getTrade(id: string): Promise<Trade | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase.from("trades").select("*").eq("id", id).eq("owner", user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const trade = rowToTrade(data as TradeRow);
  trade.screenshots = await listScreenshotsForTrade(id);
  return trade;
}

export interface TradeFilters {
  accountId?: string;
  includeDemo?: boolean;
  dateFrom?: string;
  dateTo?: string;
  instrument?: string;
  result?: TradeResult | "all";
  direction?: Direction | "all";
  strategy?: string;
  emotion?: string;
  followedPlan?: "yes" | "no" | "all";
  status?: TradeStatus | "all";
  search?: string;
}

export async function listTrades(filters: TradeFilters = {}): Promise<Trade[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  let query = supabase.from("trades").select("*").eq("owner", user.id).order("entry_time", { ascending: false });

  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (!filters.includeDemo) query = query.eq("is_demo", false);
  if (filters.instrument) query = query.eq("instrument", filters.instrument);
  if (filters.result && filters.result !== "all") query = query.eq("result", filters.result);
  if (filters.direction && filters.direction !== "all") query = query.eq("direction", filters.direction);
  if (filters.strategy) query = query.eq("strategy", filters.strategy);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.followedPlan && filters.followedPlan !== "all") {
    query = query.eq("followed_plan", filters.followedPlan === "yes");
  }
  if (filters.emotion) query = query.contains("emotion_tags", [filters.emotion]);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data as TradeRow[];

  // exit_time-or-entry_time date range and free-text search aren't expressible
  // cleanly as a single query-builder chain across two columns, so they're
  // applied in-memory after the rest of the filtering above.
  if (filters.dateFrom) rows = rows.filter((r) => (r.exit_time ?? r.entry_time) >= filters.dateFrom!);
  if (filters.dateTo) rows = rows.filter((r) => (r.exit_time ?? r.entry_time) <= filters.dateTo!);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(
      (r) => r.instrument.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.strategy ?? "").toLowerCase().includes(q)
    );
  }

  const trades = rows.map(rowToTrade);
  const screenshotsByTrade = await listScreenshotsForTrades(trades.map((t) => t.id));
  for (const trade of trades) {
    trade.screenshots = screenshotsByTrade.get(trade.id) ?? [];
  }
  return trades;
}

export async function duplicateTrade(id: string): Promise<Trade | null> {
  const original = await getTrade(id);
  if (!original) return null;
  return createTrade({
    accountId: original.accountId,
    isDemo: original.isDemo,
    instrument: original.instrument,
    direction: original.direction,
    entryTime: new Date().toISOString(),
    exitTime: null,
    entryPrice: original.entryPrice,
    stopLoss: original.stopLoss,
    takeProfit: original.takeProfit,
    exitPrice: null,
    positionSize: original.positionSize,
    accountBalanceAtEntry: original.accountBalanceAtEntry,
    riskPercent: original.riskPercent,
    riskAmount: null,
    fees: 0,
    commission: 0,
    swap: 0,
    status: "open",
    result: null,
    realizedPnl: null,
    actualR: null,
    strategy: original.strategy,
    setupGrade: original.setupGrade,
    followedPlan: true,
    emotionTags: [],
    customTags: original.customTags,
    preTrade: original.preTrade,
    duringTrade: emptyDuringTrade,
    postTrade: emptyPostTrade,
  });
}

export async function deleteAllDemoTrades(): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase.from("trades").delete().eq("is_demo", true).eq("owner", user.id);
  if (error) throw error;
}

export async function tradeCount(): Promise<number> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { count, error } = await supabase.from("trades").select("*", { count: "exact", head: true }).eq("owner", user.id);
  if (error) throw error;
  return count ?? 0;
}
