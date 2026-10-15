import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/repository/accounts";
import { listTrades } from "@/lib/repository/trades";
import { getSettings } from "@/lib/repository/settings";
import { listWeeklyReviews, listMonthlyReviews, listMistakes } from "@/lib/repository/reviews";

export async function GET() {
  const backup = {
    exportedAt: new Date().toISOString(),
    accounts: await listAccounts(),
    trades: await listTrades({ includeDemo: true }),
    settings: await getSettings(),
    weeklyReviews: await listWeeklyReviews(),
    monthlyReviews: await listMonthlyReviews(),
    mistakes: await listMistakes(),
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="trading-journal-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
