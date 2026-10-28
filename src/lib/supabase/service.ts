// SERVICE-ROLE CLIENT — bypasses Row Level Security entirely.
//
// Used ONLY by src/app/api/cron/*, which authenticate every request via
// CRON_SECRET before this client is ever touched. Every query made with
// this client MUST include an explicit .eq("owner", ownerId) (or equivalent)
// filter by hand — RLS is not there to do it for us here, unlike every
// other data-access path in this app.
//
// Deliberately a separate file from admin.ts, which is documented as
// migration-script-only and never imported from src/app — this keeps that
// contract intact while giving the cron routes their own narrow, audited
// privileged client.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set to run scheduled jobs.");
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
