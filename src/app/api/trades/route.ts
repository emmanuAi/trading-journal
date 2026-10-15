import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { listTrades, createTrade, type TradeInput } from "@/lib/repository/trades";
import { getSettings } from "@/lib/repository/settings";

export async function GET(req: Request) {
  // Bootstrapping (default account + demo data) only needs to happen once
  // per owner and is already covered by GET /api/accounts, which every page
  // calls on load — doing it again here was adding ~2 redundant Supabase
  // round trips to every trades fetch for no benefit once an owner is set up.
  const { searchParams } = new URL(req.url);
  const settings = await getSettings();
  const aggregated = searchParams.get("aggregated") === "true";

  const trades = await listTrades({
    accountId: aggregated ? undefined : searchParams.get("accountId") ?? undefined,
    includeDemo: searchParams.has("includeDemo") ? searchParams.get("includeDemo") === "true" : settings.showDemoData,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    instrument: searchParams.get("instrument") ?? undefined,
    result: (searchParams.get("result") as TradeInput["result"] | "all") ?? undefined,
    direction: (searchParams.get("direction") as TradeInput["direction"] | "all") ?? undefined,
    strategy: searchParams.get("strategy") ?? undefined,
    emotion: searchParams.get("emotion") ?? undefined,
    followedPlan: (searchParams.get("followedPlan") as "yes" | "no" | "all") ?? undefined,
    status: (searchParams.get("status") as TradeInput["status"] | "all") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  return NextResponse.json({ trades });
}

export async function POST(req: Request) {
  await ensureBootstrap();
  const body = (await req.json()) as TradeInput;

  if (!body.accountId || !body.instrument || !body.direction || !body.entryTime || body.entryPrice == null) {
    return NextResponse.json(
      { error: "accountId, instrument, direction, entryTime and entryPrice are required." },
      { status: 400 }
    );
  }

  try {
    const trade = await createTrade(body);
    return NextResponse.json({ trade }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create trade." }, { status: 400 });
  }
}
