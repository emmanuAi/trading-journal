import { randomUUID } from "crypto";
import { createClient, requireUser } from "../supabase/server";
import type { Screenshot } from "../types";

const BUCKET = "trade-screenshots";
const SIGNED_URL_TTL_SECONDS = 60;

interface ScreenshotRow {
  id: string;
  trade_id: string;
  phase: string;
  storage_path: string;
  original_name: string;
  created_at: string;
}

function rowToScreenshot(row: ScreenshotRow): Screenshot {
  return {
    id: row.id,
    tradeId: row.trade_id,
    phase: row.phase as Screenshot["phase"],
    filePath: row.storage_path,
    originalName: row.original_name,
    createdAt: row.created_at,
  };
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function saveScreenshot(tradeId: string, phase: Screenshot["phase"], file: File): Promise<Screenshot> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new Error("Unsupported file type. Only JPG, PNG and WebP are allowed.");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);

  // tradeId is caller-supplied; the route that calls this already verifies
  // ownership via getTrade(), but check again here too (a raw query, not an
  // import of trades.ts, to avoid a circular dependency) so this function is
  // safe to call from anywhere in the future without relying on callers to
  // remember the pre-check.
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id")
    .eq("id", tradeId)
    .eq("owner", user.id)
    .maybeSingle();
  if (tradeError) throw tradeError;
  if (!trade) throw new Error("Trade not found.");

  const storagePath = `${user.id}/${tradeId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("screenshots")
    .insert({
      owner: user.id,
      trade_id: tradeId,
      phase,
      storage_path: storagePath,
      original_name: file.name,
    })
    .select()
    .single();
  if (error) throw error;

  return rowToScreenshot(data as ScreenshotRow);
}

export async function listScreenshotsForTrade(tradeId: string): Promise<Screenshot[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("screenshots")
    .select("*")
    .eq("trade_id", tradeId)
    .eq("owner", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ScreenshotRow[]).map(rowToScreenshot);
}

/** Batched form of listScreenshotsForTrade for listing many trades at once
 * (dashboard/journal/analytics) — one query total instead of one query (plus
 * one auth round trip) per trade. That per-trade version used to be called
 * in a loop from listTrades() and was the main cause of multi-second/stuck
 * dashboard loads once there were dozens of trades. */
export async function listScreenshotsForTrades(tradeIds: string[]): Promise<Map<string, Screenshot[]>> {
  const result = new Map<string, Screenshot[]>();
  if (tradeIds.length === 0) return result;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("screenshots")
    .select("*")
    .in("trade_id", tradeIds)
    .eq("owner", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  for (const row of data as ScreenshotRow[]) {
    const screenshot = rowToScreenshot(row);
    const list = result.get(screenshot.tradeId);
    if (list) list.push(screenshot);
    else result.set(screenshot.tradeId, [screenshot]);
  }
  return result;
}

export async function getScreenshot(id: string): Promise<Screenshot | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase.from("screenshots").select("*").eq("id", id).eq("owner", user.id).maybeSingle();
  if (error) throw error;
  return data ? rowToScreenshot(data as ScreenshotRow) : null;
}

export async function deleteScreenshot(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const shot = await getScreenshot(id);
  if (!shot) return;

  const { error: removeError } = await supabase.storage.from(BUCKET).remove([shot.filePath]);
  if (removeError) throw removeError;

  const { error } = await supabase.from("screenshots").delete().eq("id", id).eq("owner", user.id);
  if (error) throw error;
}

/** Looks up a screenshot by its storage path, scoped to the caller via RLS —
 * this is the ownership check the old local-disk file route lacked, and
 * returns null for both "doesn't exist" and "isn't yours" so callers can't
 * tell the difference. */
export async function getScreenshotByStoragePath(storagePath: string): Promise<Screenshot | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("screenshots")
    .select("*")
    .eq("storage_path", storagePath)
    .eq("owner", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToScreenshot(data as ScreenshotRow) : null;
}

export async function getSignedScreenshotUrl(storagePath: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw error ?? new Error("Failed to create signed URL.");
  return data.signedUrl;
}
