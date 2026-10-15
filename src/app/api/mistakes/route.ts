import { NextResponse } from "next/server";
import { listMistakes, createMistake, deleteMistake } from "@/lib/repository/reviews";

export async function GET() {
  return NextResponse.json({ mistakes: await listMistakes() });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }
  const mistake = await createMistake({
    title: body.title,
    description: body.description ?? "",
    relatedTradeId: body.relatedTradeId ?? null,
    tag: body.tag ?? "",
  });
  return NextResponse.json({ mistake }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deleteMistake(id);
  return NextResponse.json({ ok: true });
}
