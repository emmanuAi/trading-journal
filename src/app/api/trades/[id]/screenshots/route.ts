import { NextResponse } from "next/server";
import { getTrade } from "@/lib/repository/trades";
import { saveScreenshot } from "@/lib/repository/screenshots";
import type { Screenshot } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trade = await getTrade(id);
  if (!trade) return NextResponse.json({ error: "Trade not found." }, { status: 404 });

  const formData = await req.formData();
  const phase = formData.get("phase");
  const files = formData.getAll("files");

  if (phase !== "before" && phase !== "during" && phase !== "after") {
    return NextResponse.json({ error: "phase must be one of before, during, after." }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }

  const saved: Screenshot[] = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    try {
      saved.push(await saveScreenshot(id, phase, file));
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 400 });
    }
  }

  return NextResponse.json({ screenshots: saved }, { status: 201 });
}
