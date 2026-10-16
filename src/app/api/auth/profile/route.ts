import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";

const MAX_NAME_LENGTH = 80;

/** Updates the CALLER'S OWN name metadata only. supabase.auth.updateUser()
 * acts on the session's own access token — it has no "target user id"
 * parameter, so there is no way for this route to modify any other user's
 * profile even in principle. (Cross-user admin updates would require
 * supabase.auth.admin.updateUserById() with the service-role key, which
 * this route never touches.) */
export async function PATCH(req: Request) {
  const supabase = await createClient();
  await requireUser(supabase);

  const body = await req.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";

  if (!firstName) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }
  if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  const { data, error } = await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName },
  });
  if (error) {
    return NextResponse.json({ error: "Failed to update profile." }, { status: 400 });
  }

  return NextResponse.json({
    firstName: (data.user.user_metadata?.first_name as string) ?? firstName,
    lastName: (data.user.user_metadata?.last_name as string) ?? lastName,
  });
}
