import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";

/** The only surface exposing anything about the global ai_budget_ledger —
 * see decision 8 of the plan. Returns a bucketed status, never the raw
 * dollar figures. */
export async function GET() {
  const supabase = await createClient();

  try {
    await requireUser(supabase);
  } catch {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_ai_budget_status");
  if (error) {
    console.error("[coach/budget-status] rpc failed:", error.message);
    return NextResponse.json({ error: "Unable to load budget status." }, { status: 503 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    status: row?.status ?? "ok",
    percentUsed: row?.percent_used ?? 0,
    warning: row?.warning ?? false,
  });
}
