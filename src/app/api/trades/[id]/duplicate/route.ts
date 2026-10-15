import { NextResponse } from "next/server";
import { duplicateTrade } from "@/lib/repository/trades";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trade = await duplicateTrade(id);
  if (!trade) return NextResponse.json({ error: "Trade not found." }, { status: 404 });
  return NextResponse.json({ trade }, { status: 201 });
}
