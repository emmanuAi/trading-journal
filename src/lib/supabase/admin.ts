// SERVICE-ROLE CLIENT — bypasses Row Level Security entirely.
//
// Do NOT import this from anything under src/app or any other code path that
// runs in the deployed, request-serving app. It exists only for
// scripts/migrate-to-supabase.ts, which runs locally, once, by hand.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.");
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
