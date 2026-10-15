import { NextResponse } from "next/server";
import { getScreenshot, deleteScreenshot } from "@/lib/repository/screenshots";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getScreenshot(id);
  if (!existing) return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
  await deleteScreenshot(id);
  return NextResponse.json({ ok: true });
}
