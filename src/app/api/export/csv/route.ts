import { NextResponse } from "next/server";
import { listTrades } from "@/lib/repository/trades";
import { tradesToCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const aggregated = searchParams.get("aggregated") === "true";

  const trades = await listTrades({ accountId: aggregated ? undefined : accountId, includeDemo: false });
  const csv = tradesToCsv(trades);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trading-journal-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
