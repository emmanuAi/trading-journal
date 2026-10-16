/** Reads first/last name out of a Supabase Auth user's own metadata.
 * Never derives a name from the email address — if nothing has been set,
 * callers get an explicit `hasName: false` so they can prompt the user to
 * fill it in, rather than guessing. */
export function extractProfileName(metadata: Record<string, unknown> | undefined) {
  const firstName = typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
  const lastName = typeof metadata?.last_name === "string" ? metadata.last_name.trim() : "";

  return {
    firstName: firstName || "Trader",
    lastName,
    hasName: firstName.length > 0,
  };
}
