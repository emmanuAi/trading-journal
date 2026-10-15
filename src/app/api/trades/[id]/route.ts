import { NextResponse } from "next/server";
import { getTrade, updateTrade, deleteTrade, type TradeInput } from "@/lib/repository/trades";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trade = await getTrade(id);
  if (!trade) return NextResponse.json({ error: "Trade not found." }, { status: 404 });
  return NextResponse.json({ trade });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as TradeInput;
  try {
    const trade = await updateTrade(id, body);
    if (!trade) return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    return NextResponse.json({ trade });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update trade." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getTrade(id);
  if (!existing) return NextResponse.json({ error: "Trade not found." }, { status: 404 });
  await deleteTrade(id);
  return NextResponse.json({ ok: true });
}
