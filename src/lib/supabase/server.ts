import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Request-scoped Supabase client, built fresh per request from the incoming
// session cookies (unlike the old getDb() module-level singleton, this one
// carries the caller's identity, which is what makes RLS work).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render — proxy.ts refreshes the
            // session on every request, so this is safe to ignore here.
          }
        },
      },
    }
  );
}

/** Validates the session against Supabase's auth server (rather than trusting
 * the cookie's claims blindly) and throws if there isn't one. Takes an
 * already-created client so callers that also need `supabase` for queries
 * don't pay for a second client/round trip. */
export async function requireUser(supabase: SupabaseClient): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated.");
  return data.user;
}
