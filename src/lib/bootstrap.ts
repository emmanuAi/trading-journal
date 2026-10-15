import { ensureDefaultAccount } from "./repository/accounts";
import { seedDemoDataIfNeeded } from "./demo-data";

/** Ensures the current authenticated owner has a default account and, if
 * they have no trades yet, demo data. Runs per-request (not once per server
 * process like the old SQLite version) because under Supabase there's no
 * "the one global owner" at instrumentation time — only a request carries a
 * session. Cheap to call on every request: both steps are no-ops once the
 * owner already has data. */
export async function ensureBootstrap(): Promise<void> {
  await ensureDefaultAccount();
  await seedDemoDataIfNeeded();
}
