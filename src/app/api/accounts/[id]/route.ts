import { NextResponse } from "next/server";
import { updateAccount, deleteAccount, getAccount } from "@/lib/repository/accounts";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const account = await updateAccount(id, body);
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ account });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getAccount(id);
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  await deleteAccount(id);
  return NextResponse.json({ ok: true });
}
