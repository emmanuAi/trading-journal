import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getSettings, updateSettings } from "@/lib/repository/settings";
import { clearDemoData } from "@/lib/demo-data";

export async function GET() {
  // See the comment in api/trades/route.ts GET — bootstrap already runs via
  // GET /api/accounts on every page load, so it's not repeated here.
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(req: Request) {
  await ensureBootstrap();
  const body = await req.json();
  const settings = await updateSettings(body);
  return NextResponse.json({ settings });
}

// Permanently deletes all demo trades (distinct from the showDemoData display toggle).
export async function DELETE() {
  await clearDemoData();
  return NextResponse.json({ ok: true });
}
