import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { listAccounts, createAccount } from "@/lib/repository/accounts";

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ accounts: await listAccounts() });
}

export async function POST(req: Request) {
  await ensureBootstrap();
  const body = await req.json();
  if (!body.name || !body.baseCurrency || body.startingBalance == null) {
    return NextResponse.json({ error: "name, baseCurrency and startingBalance are required." }, { status: 400 });
  }
  const account = await createAccount({
    name: body.name,
    type: body.type === "prop_firm" ? "prop_firm" : "personal",
    baseCurrency: body.baseCurrency,
    startingBalance: Number(body.startingBalance),
    isDefault: !!body.isDefault,
  });
  return NextResponse.json({ account }, { status: 201 });
}
