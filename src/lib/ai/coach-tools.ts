import type Anthropic from "@anthropic-ai/sdk";
import { listAccounts } from "@/lib/repository/accounts";
import { listTrades, type TradeFilters } from "@/lib/repository/trades";
import {
  winRateStats,
  netPnl,
  profitFactor,
  averageActualR,
  totalR,
  largestWin,
  largestLoss,
  maxDrawdownPercent,
  returnPercent,
  currentStreak,
  planCompliance,
  pipStatistics,
} from "@/lib/calculations";
import type { CoachScope } from "./scope";

/** Every tool here is scoped by closure to the `CoachScope` resolved once,
 * server-side, before the model ever sees a tool definition — there is no
 * accountId parameter the model can set, so it has no path to ask for a
 * different account's data than the one the request was scoped to. Trade
 * data is fetched through the same owner-scoped repository layer (and the
 * same RLS boundary) every other page in the app uses; every number below
 * comes from src/lib/calculations.ts, never computed ad hoc here. */

const DATE_PARAMS = {
  dateFrom: { type: "string" as const, description: "Inclusive start date, YYYY-MM-DD. Omit for no lower bound." },
  dateTo: { type: "string" as const, description: "Inclusive end date, YYYY-MM-DD. Omit for no upper bound." },
};

export const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_account_summary",
    description:
      "Get the trading account(s) in scope for this conversation: name, type, base currency, and starting balance. Call this first if you need to know which account(s) you're discussing.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_trade_stats",
    description:
      "Deterministic performance statistics (win rate, net P&L, profit factor, average R, drawdown, streak, plan compliance) over closed trades in scope, optionally filtered by date range and instrument.",
    input_schema: {
      type: "object",
      properties: {
        ...DATE_PARAMS,
        instrument: { type: "string", description: "Exact instrument symbol, e.g. EURUSD. Omit for all instruments." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_pip_stats",
    description: "Deterministic pip-based statistics (realized pips, average win/loss in pips) over trades in scope.",
    input_schema: { type: "object", properties: DATE_PARAMS, additionalProperties: false },
  },
  {
    name: "get_trades",
    description:
      "Individual trade rows in scope, most recent first — use for questions about specific trades (e.g. 'my worst trades', 'recent EURUSD trades'). Capped at 20 rows; ask a narrower question (date range, instrument, result) rather than requesting more.",
    input_schema: {
      type: "object",
      properties: {
        ...DATE_PARAMS,
        instrument: { type: "string", description: "Exact instrument symbol. Omit for all instruments." },
        result: { type: "string", enum: ["win", "loss", "breakeven"], description: "Omit for all results." },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "Defaults to 10." },
      },
      additionalProperties: false,
    },
  },
];

async function scopedTrades(scope: CoachScope, extra: Omit<TradeFilters, "accountId" | "includeDemo"> = {}) {
  return listTrades({ ...extra, accountId: scope.accountId ?? undefined, includeDemo: false });
}

async function scopedStartingBalance(scope: CoachScope): Promise<number> {
  const accounts = await listAccounts();
  return accounts.filter((a) => scope.accountIds.includes(a.id)).reduce((sum, a) => sum + a.startingBalance, 0);
}

export async function executeCoachTool(name: string, input: unknown, scope: CoachScope): Promise<unknown> {
  const args = (input ?? {}) as Record<string, unknown>;

  switch (name) {
    case "get_account_summary": {
      const accounts = await listAccounts();
      return {
        scope: scope.aggregated ? "aggregated_all_accounts" : "single_account",
        accounts: accounts
          .filter((a) => scope.accountIds.includes(a.id))
          .map((a) => ({ name: a.name, type: a.type, baseCurrency: a.baseCurrency, startingBalance: a.startingBalance })),
      };
    }

    case "get_trade_stats": {
      const trades = await scopedTrades(scope, {
        dateFrom: typeof args.dateFrom === "string" ? args.dateFrom : undefined,
        dateTo: typeof args.dateTo === "string" ? args.dateTo : undefined,
        instrument: typeof args.instrument === "string" ? args.instrument : undefined,
        status: "closed",
      });
      const startingBalance = await scopedStartingBalance(scope);
      const win = winRateStats(trades);
      return {
        closedTradesCount: trades.length,
        winRate: win.winRate,
        wins: win.wins,
        losses: win.losses,
        breakevens: win.breakevens,
        netPnl: netPnl(trades),
        profitFactor: profitFactor(trades),
        averageActualR: averageActualR(trades),
        totalR: totalR(trades),
        largestWin: largestWin(trades),
        largestLoss: largestLoss(trades),
        maxDrawdownPercent: maxDrawdownPercent(trades, startingBalance),
        returnPercent: returnPercent(trades, startingBalance),
        currentStreak: currentStreak(trades),
        planCompliancePercent: planCompliance(trades),
      };
    }

    case "get_pip_stats": {
      const trades = await scopedTrades(scope, {
        dateFrom: typeof args.dateFrom === "string" ? args.dateFrom : undefined,
        dateTo: typeof args.dateTo === "string" ? args.dateTo : undefined,
        status: "closed",
      });
      return pipStatistics(trades);
    }

    case "get_trades": {
      const limit = typeof args.limit === "number" ? Math.min(Math.max(1, Math.floor(args.limit)), 20) : 10;
      const trades = await scopedTrades(scope, {
        dateFrom: typeof args.dateFrom === "string" ? args.dateFrom : undefined,
        dateTo: typeof args.dateTo === "string" ? args.dateTo : undefined,
        instrument: typeof args.instrument === "string" ? args.instrument : undefined,
        result: args.result === "win" || args.result === "loss" || args.result === "breakeven" ? args.result : undefined,
      });
      return trades.slice(0, limit).map((t) => ({
        id: t.id,
        instrument: t.instrument,
        direction: t.direction,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        status: t.status,
        result: t.result,
        realizedPnl: t.realizedPnl,
        actualR: t.actualR,
        strategy: t.strategy,
        setupGrade: t.setupGrade,
        followedPlan: t.followedPlan,
      }));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
