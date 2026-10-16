import { createClient, requireUser } from "@/lib/supabase/server";
import { extractProfileName } from "@/lib/profile";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { firstName, lastName, hasName } = extractProfileName(user.user_metadata as Record<string, unknown> | undefined);

  return <SettingsClient initialFirstName={hasName ? firstName : ""} initialLastName={lastName} />;
}
