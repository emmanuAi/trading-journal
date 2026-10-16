import { createClient, requireUser } from "@/lib/supabase/server";
import { extractProfileName } from "@/lib/profile";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { firstName, hasName } = extractProfileName(user.user_metadata as Record<string, unknown> | undefined);

  return <DashboardClient firstName={firstName} hasName={hasName} />;
}
