/**
 * One-off migration: local SQLite (data/trading-journal.db) + local disk
 * screenshots (storage/screenshots/) -> Supabase Postgres + Storage, tagged
 * with a single owner uuid.
 *
 * NOT part of the deployed app. Run locally, by hand, once, after:
 *   1. db/supabase-schema.sql has been applied to the target Supabase project.
 *   2. The owner's Supabase Auth user has been created (dashboard ->
 *      Authentication -> Users -> Add user) and you have their user id.
 *   3. .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/migrate-to-supabase.ts --owner <supabase-auth-user-uuid> [--force]
 *   (or: npm run migrate -- --owner <uuid>)
 *
 * Safety:
 *   - Backs up data/trading-journal.db and storage/screenshots/ into
 *     backups/<timestamp>/ before anything else, and aborts if that fails.
 *   - Opens the SQLite file read-only — this script cannot mutate it.
 *   - Never deletes or modifies the original SQLite file or screenshot
 *     directory. Its only destructive-capable operations are new writes to
 *     Postgres/Storage (the migration target, not the source).
 *   - Refuses to run without --owner. Refuses to re-run against an owner
 *     that already has migrated data unless --force is passed.
 *   - Ends with a verification pass (row counts, a P&L spot-check, and a
 *     screenshot count/size check) and does not declare success on mismatch.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { createAdminClient } from "../src/lib/supabase/admin";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "trading-journal.db");
const SCREENSHOTS_DIR = path.join(process.cwd(), "storage", "screenshots");
const BUCKET = "trade-screenshots";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const ownerIndex = args.indexOf("--owner");
  const owner = ownerIndex !== -1 ? args[ownerIndex + 1] : undefined;
  const force = args.includes("--force");
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!owner || !uuidPattern.test(owner)) {
    console.error("Usage: npx tsx scripts/migrate-to-supabase.ts --owner <supabase-auth-user-uuid> [--force]");
    process.exit(1);
  }
  return { owner, force };
}

async function backup(): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(process.cwd(), "backups", stamp);
  fs.mkdirSync(dest, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    // A plain file copy of DB_PATH alone is NOT a valid backup: this app
    // runs SQLite in WAL mode, and most/all committed data can live in the
    // companion -wal file rather than the main .db file until a checkpoint
    // happens. Copying just the .db file can silently produce a backup
    // that opens fine but is missing tables/rows. better-sqlite3's backup()
    // uses SQLite's online backup API, which correctly merges WAL content
    // into a single consistent snapshot regardless of checkpoint state.
    const liveDb = new Database(DB_PATH, { readonly: true });
    await liveDb.backup(path.join(dest, "trading-journal.db"));
    liveDb.close();
  }
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    fs.cpSync(SCREENSHOTS_DIR, path.join(dest, "screenshots"), { recursive: true });
  }
  return dest;
}

type Row = Record<string, unknown>;

async function main() {
  const { owner, force } = parseArgs();

  console.log(`[1/7] Backing up local data before touching anything...`);
  const backupDir = await backup();
  console.log(`      Backup written to ${backupDir}`);

  console.log(`[2/7] Opening local SQLite read-only...`);
  if (!fs.existsSync(DB_PATH)) {
    console.error(`      No database found at ${DB_PATH}. Nothing to migrate.`);
    process.exit(1);
  }
  const db = new Database(DB_PATH, { readonly: true });

  // Verify the backup actually contains what the live database has, before
  // trusting it as a safety net for anything below.
  const backupDb = new Database(path.join(backupDir, "trading-journal.db"), { readonly: true });
  for (const table of ["accounts", "trades", "screenshots", "weekly_reviews", "monthly_reviews", "mistakes"]) {
    const live = (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;
    const backed = (backupDb.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;
    if (live !== backed) {
      backupDb.close();
      throw new Error(`Backup verification failed for table ${table}: live=${live} backup=${backed}. Aborting.`);
    }
  }
  backupDb.close();
  console.log(`      Backup verified against the live database — row counts match.`);

  const admin = createAdminClient();

  console.log(`[3/7] Checking for existing data under owner ${owner}...`);
  const { count: existingTrades, error: countError } = await admin
    .from("trades")
    .select("*", { count: "exact", head: true })
    .eq("owner", owner);
  if (countError) throw new Error(`Failed to check existing data: ${countError.message}`);
  if ((existingTrades ?? 0) > 0 && !force) {
    console.error(
      `      Owner ${owner} already has ${existingTrades} trade(s) in Supabase. Re-run with --force if you really want to proceed.`
    );
    process.exit(1);
  }

  console.log(`[4/7] Migrating rows...`);

  const accountRows = db.prepare("SELECT * FROM accounts ORDER BY created_at ASC").all() as Row[];
  for (const a of accountRows) {
    const { error } = await admin.from("accounts").insert({
      id: a.id,
      owner,
      name: a.name,
      type: a.type,
      base_currency: a.base_currency,
      starting_balance: a.starting_balance,
      is_default: !!a.is_default,
      created_at: a.created_at,
    });
    if (error) throw new Error(`accounts insert failed (id=${a.id}): ${error.message}`);
  }
  console.log(`      accounts: ${accountRows.length}`);

  const tradeRows = db.prepare("SELECT * FROM trades ORDER BY created_at ASC").all() as Row[];
  for (const t of tradeRows) {
    const { error } = await admin.from("trades").insert({
      id: t.id,
      owner,
      account_id: t.account_id,
      is_demo: !!t.is_demo,
      instrument: t.instrument,
      direction: t.direction,
      entry_time: t.entry_time,
      exit_time: t.exit_time,
      entry_price: t.entry_price,
      stop_loss: t.stop_loss,
      take_profit: t.take_profit,
      exit_price: t.exit_price,
      position_size: t.position_size,
      account_balance_at_entry: t.account_balance_at_entry,
      risk_percent: t.risk_percent,
      risk_amount: t.risk_amount,
      fees: t.fees,
      commission: t.commission,
      swap: t.swap,
      status: t.status,
      result: t.result,
      realized_pnl: t.realized_pnl,
      planned_rr: t.planned_rr,
      actual_r: t.actual_r,
      strategy: t.strategy,
      setup_grade: t.setup_grade,
      followed_plan: !!t.followed_plan,
      emotion_tags: JSON.parse((t.emotion_tags as string) || "[]"),
      custom_tags: JSON.parse((t.custom_tags as string) || "[]"),
      pre_trade: JSON.parse((t.pre_trade as string) || "{}"),
      during_trade: JSON.parse((t.during_trade as string) || "{}"),
      post_trade: JSON.parse((t.post_trade as string) || "{}"),
      created_at: t.created_at,
      updated_at: t.updated_at,
    });
    if (error) throw new Error(`trades insert failed (id=${t.id}): ${error.message}`);
  }
  console.log(`      trades: ${tradeRows.length}`);

  const maxSuffix = tradeRows.reduce((max, t) => {
    const match = /^TJ-(\d+)$/.exec(String(t.id));
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  if (maxSuffix > 0) {
    const { error } = await admin.rpc("admin_set_trade_id_seq", { value: maxSuffix });
    if (error) throw new Error(`Failed to advance trade_id_seq: ${error.message}`);
    console.log(`      advanced trade_id_seq to ${maxSuffix}`);
  }

  const screenshotRows = db.prepare("SELECT * FROM screenshots ORDER BY created_at ASC").all() as Row[];
  let uploadedBytes = 0;
  for (const s of screenshotRows) {
    const localPath = path.join(SCREENSHOTS_DIR, String(s.file_path));
    if (!fs.existsSync(localPath)) {
      throw new Error(`Screenshot file missing on disk: ${localPath} (referenced by screenshot id=${s.id})`);
    }
    const buffer = fs.readFileSync(localPath);
    uploadedBytes += buffer.byteLength;
    const ext = path.extname(localPath).toLowerCase();
    const storagePath = `${owner}/${s.trade_id}/${path.basename(localPath)}`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
    });
    if (uploadError) throw new Error(`Screenshot upload failed (id=${s.id}): ${uploadError.message}`);

    const { error: insertError } = await admin.from("screenshots").insert({
      id: s.id,
      owner,
      trade_id: s.trade_id,
      phase: s.phase,
      storage_path: storagePath,
      original_name: s.original_name,
      created_at: s.created_at,
    });
    if (insertError) throw new Error(`Screenshot row insert failed (id=${s.id}): ${insertError.message}`);
  }
  console.log(`      screenshots: ${screenshotRows.length}`);

  const settingsRow = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Row | undefined;
  if (settingsRow) {
    const { error } = await admin.from("settings").upsert({
      owner,
      base_currency: settingsRow.base_currency,
      timezone: settingsRow.timezone,
      default_account_id: settingsRow.default_account_id,
      default_risk_percent: settingsRow.default_risk_percent,
      strategies: JSON.parse((settingsRow.strategies as string) || "[]"),
      custom_tags: JSON.parse((settingsRow.custom_tags as string) || "[]"),
      show_demo_data: !!settingsRow.show_demo_data,
    });
    if (error) throw new Error(`settings upsert failed: ${error.message}`);
  }
  console.log(`      settings: ${settingsRow ? 1 : 0}`);

  const weeklyRows = db.prepare("SELECT * FROM weekly_reviews ORDER BY created_at ASC").all() as Row[];
  for (const r of weeklyRows) {
    const { error } = await admin.from("weekly_reviews").insert({
      id: r.id,
      owner,
      week_start: r.week_start,
      wins: r.wins,
      mistakes: r.mistakes,
      lessons: r.lessons,
      goal_for_next_week: r.goal_for_next_week,
      created_at: r.created_at,
    });
    if (error) throw new Error(`weekly_reviews insert failed (id=${r.id}): ${error.message}`);
  }
  console.log(`      weekly_reviews: ${weeklyRows.length}`);

  const monthlyRows = db.prepare("SELECT * FROM monthly_reviews ORDER BY created_at ASC").all() as Row[];
  for (const r of monthlyRows) {
    const { error } = await admin.from("monthly_reviews").insert({
      id: r.id,
      owner,
      month_start: r.month_start,
      summary: r.summary,
      lessons: r.lessons,
      goal_for_next_month: r.goal_for_next_month,
      created_at: r.created_at,
    });
    if (error) throw new Error(`monthly_reviews insert failed (id=${r.id}): ${error.message}`);
  }
  console.log(`      monthly_reviews: ${monthlyRows.length}`);

  const mistakeRows = db.prepare("SELECT * FROM mistakes ORDER BY created_at ASC").all() as Row[];
  for (const m of mistakeRows) {
    const { error } = await admin.from("mistakes").insert({
      id: m.id,
      owner,
      title: m.title,
      description: m.description,
      related_trade_id: m.related_trade_id,
      tag: m.tag,
      created_at: m.created_at,
    });
    if (error) throw new Error(`mistakes insert failed (id=${m.id}): ${error.message}`);
  }
  console.log(`      mistakes: ${mistakeRows.length}`);

  db.close();

  console.log(`[5/7] Verifying row counts...`);
  let ok = true;
  const tableCounts: Array<[string, number]> = [
    ["accounts", accountRows.length],
    ["trades", tradeRows.length],
    ["screenshots", screenshotRows.length],
    ["weekly_reviews", weeklyRows.length],
    ["monthly_reviews", monthlyRows.length],
    ["mistakes", mistakeRows.length],
  ];
  for (const [table, expected] of tableCounts) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq("owner", owner);
    if (error) throw new Error(`Verification count failed for ${table}: ${error.message}`);
    const actual = count ?? 0;
    const pass = actual === expected;
    ok = ok && pass;
    console.log(`      ${table}: local=${expected} supabase=${actual} ${pass ? "OK" : "MISMATCH"}`);
  }

  console.log(`[6/7] Verifying realized P&L spot-check...`);
  const localPnlSum = tradeRows
    .filter((t) => t.status === "closed")
    .reduce((sum, t) => sum + (typeof t.realized_pnl === "number" ? t.realized_pnl : 0), 0);
  const { data: remoteTrades, error: pnlError } = await admin
    .from("trades")
    .select("realized_pnl, status")
    .eq("owner", owner);
  if (pnlError) throw new Error(`Verification P&L fetch failed: ${pnlError.message}`);
  const remotePnlSum = (remoteTrades ?? [])
    .filter((t) => t.status === "closed")
    .reduce((sum, t) => sum + (typeof t.realized_pnl === "number" ? t.realized_pnl : 0), 0);
  const pnlMatches = Math.abs(localPnlSum - remotePnlSum) < 0.01;
  ok = ok && pnlMatches;
  console.log(`      local=${localPnlSum.toFixed(2)} supabase=${remotePnlSum.toFixed(2)} ${pnlMatches ? "OK" : "MISMATCH"}`);

  console.log(`[7/7] Verifying screenshot storage...`);
  let remoteFileCount = 0;
  let remoteBytes = 0;
  const { data: tradeFolders, error: listError } = await admin.storage.from(BUCKET).list(owner, { limit: 1000 });
  if (listError) throw new Error(`Verification storage list failed: ${listError.message}`);
  for (const folder of tradeFolders ?? []) {
    const { data: files, error: innerError } = await admin.storage.from(BUCKET).list(`${owner}/${folder.name}`, { limit: 1000 });
    if (innerError) throw new Error(`Verification storage list failed for ${folder.name}: ${innerError.message}`);
    for (const file of files ?? []) {
      remoteFileCount++;
      remoteBytes += file.metadata?.size ?? 0;
    }
  }
  const screenshotsMatch = remoteFileCount === screenshotRows.length && remoteBytes === uploadedBytes;
  ok = ok && screenshotsMatch;
  console.log(
    `      files: local=${screenshotRows.length} supabase=${remoteFileCount}, bytes: local=${uploadedBytes} supabase=${remoteBytes} ${
      screenshotsMatch ? "OK" : "MISMATCH"
    }`
  );

  console.log("");
  if (ok) {
    console.log(`SUCCESS — all verification checks passed. Local files were not modified; backup is at ${backupDir}.`);
  } else {
    console.error(`FAILED — one or more verification checks did not match. Do not treat this migration as complete.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Migration aborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
