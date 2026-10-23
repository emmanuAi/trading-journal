import { NextResponse } from "next/server";
import { getConversation, listAllMessages, deleteConversation } from "@/lib/repository/coach";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const messages = await listAllMessages(id);
  return NextResponse.json({ conversation, messages });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getConversation(id);
  if (!existing) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}
