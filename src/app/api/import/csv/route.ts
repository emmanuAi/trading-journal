import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { listTrades, createTrade } from "@/lib/repository/trades";

export async function POST(req: Request) {
  const body = await req.json();
  const { csv, accountId } = body as { csv: string; accountId: string };
  if (!csv || !accountId) {
    return NextResponse.json({ error: "csv and accountId are required." }, { status: 400 });
  }

  const parsed = parseCsv(csv);
  const existing = await listTrades({ accountId, includeDemo: true });
  const existingSignatures = new Set(
    existing.map((t) => `${t.instrument}|${t.direction}|${t.entryTime}|${t.entryPrice}|${t.positionSize}`)
  );

  let imported = 0;
  let skippedDuplicates = 0;
  const errors: string[] = [];

  for (const row of parsed) {
    if (!row.instrument || !row.entryTime || !row.entryPrice) {
      errors.push(`Skipped row: missing instrument/entryTime/entryPrice.`);
      continue;
    }
    if (existingSignatures.has(row.signature)) {
      skippedDuplicates++;
      continue;
    }
    try {
      await createTrade({
        accountId,
        instrument: row.instrument,
        direction: row.direction,
        entryTime: row.entryTime,
        exitTime: row.exitTime,
        entryPrice: row.entryPrice,
        stopLoss: row.stopLoss,
        takeProfit: row.takeProfit,
        exitPrice: row.exitPrice,
        positionSize: row.positionSize,
        accountBalanceAtEntry: row.accountBalanceAtEntry,
        riskPercent: row.riskPercent,
        riskAmount: row.riskAmount,
        fees: row.fees,
        commission: row.commission,
        swap: row.swap,
        status: row.status,
        result: row.result,
        realizedPnl: row.realizedPnl,
        plannedRR: row.plannedRR,
        actualR: row.actualR,
        strategy: row.strategy,
        setupGrade: row.setupGrade,
        followedPlan: row.followedPlan,
        emotionTags: row.emotionTags,
        customTags: row.customTags,
      });
      existingSignatures.add(row.signature);
      imported++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Unknown error importing row.");
    }
  }

  return NextResponse.json({ imported, skippedDuplicates, errors });
}
