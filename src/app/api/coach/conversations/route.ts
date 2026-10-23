import { NextResponse } from "next/server";
import { listConversations } from "@/lib/repository/coach";

export async function GET() {
  return NextResponse.json({ conversations: await listConversations() });
}
