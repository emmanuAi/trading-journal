import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { listAccounts } from "@/lib/repository/accounts";
import { validateChatRequest } from "@/lib/ai/chat-validation";
import { resolveAccountScope } from "@/lib/ai/scope";
import { runCoachChat } from "@/lib/ai/coach-chat";
import { COACH_TOOLS } from "@/lib/ai/coach-tools";
import { COACH_MODEL, CHAT_MAX_OUTPUT_TOKENS, MAX_TOOL_ITERATIONS } from "@/lib/ai/client";
import { estimateCallCostUsd, estimateTokensFromText, computeActualCostUsd } from "@/lib/ai/pricing";

const DAILY_CHAT_LIMIT = 50;
const RESERVE_CAP_USD = 1.0; // matches the DB function's own per-call ceiling

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

  const validation = validateChatRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Account isolation: resolved only from this user's own accounts list
  // (itself owner-scoped by RLS) — an accountId the user doesn't own is
  // rejected right here, before any tool or AI call ever runs.
  const accounts = await listAccounts();
  const scopeResult = resolveAccountScope(accounts, validation.body);
  if (!scopeResult.ok) {
    return NextResponse.json({ error: scopeResult.error }, { status: 400 });
  }
  const scope = scopeResult.scope;

  // Per-owner daily rate limit (abuse protection, independent of the
  // app-wide dollar budget below).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("owner", userId)
    .eq("kind", "chat_message")
    .neq("status", "rejected")
    .gte("created_at", since);
  if (countError) {
    console.error("[coach/chat] rate limit check failed:", countError.message);
    return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if ((count ?? 0) >= DAILY_CHAT_LIMIT) {
    return NextResponse.json({ error: "Daily chat limit reached. Please try again tomorrow." }, { status: 429 });
  }

  // Atomic monthly budget reservation — worst-case bound across every
  // iteration of the tool-use loop (see decision 8 of the plan).
  const estimatedInputTokens =
    estimateTokensFromText(JSON.stringify(COACH_TOOLS)) + estimateTokensFromText(validation.body.message) + 2000;
  const estimatedCost = Math.min(
    estimateCallCostUsd(COACH_MODEL, estimatedInputTokens, CHAT_MAX_OUTPUT_TOKENS * MAX_TOOL_ITERATIONS),
    RESERVE_CAP_USD
  );

  const { data: reserveRows, error: reserveError } = await supabase.rpc("reserve_ai_spend", {
    p_kind: "chat_message",
    p_estimated_usd: estimatedCost,
  });
  if (reserveError) {
    console.error("[coach/chat] budget reservation failed:", reserveError.message);
    return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again shortly." }, { status: 503 });
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
      console.error("[coach/chat] reconcile failed:", err instanceof Error ? err.message : err);
    }
  }

  try {
    const result = await runCoachChat(validation.body.message, scope);
    const actualCost = computeActualCostUsd(COACH_MODEL, {
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      cache_creation_input_tokens: result.usage.cacheCreationInputTokens,
      cache_read_input_tokens: result.usage.cacheReadInputTokens,
    });
    await reconcile(actualCost);
    return NextResponse.json({ reply: result.reply });
  } catch (err) {
    await reconcile(0);
    // Never log the request/response bodies or any header — just enough to
    // diagnose which failure mode happened, never secrets.
    console.error("[coach/chat] Anthropic call failed:", err instanceof Error ? err.message : "unknown error");

    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "The AI coach is receiving too many requests right now. Please try again shortly." }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "The AI coach is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong answering that. Please try again." }, { status: 500 });
  }
}
