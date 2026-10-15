import { NextResponse } from "next/server";
import { getScreenshotByStoragePath, getSignedScreenshotUrl } from "@/lib/repository/screenshots";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const storagePath = segments.join("/");

  // RLS-backed lookup: only resolves if this storage path belongs to the
  // caller, so a 404 here covers both "doesn't exist" and "isn't yours".
  const screenshot = await getScreenshotByStoragePath(storagePath);
  if (!screenshot) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const signedUrl = await getSignedScreenshotUrl(storagePath);
  return NextResponse.redirect(signedUrl, 302);
}
