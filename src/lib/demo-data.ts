import { ensureDefaultAccount } from "./repository/accounts";
import { createTrade, tradeCount, deleteAllDemoTrades } from "./repository/trades";
import { INSTRUMENTS } from "./instruments";
import type { Direction, SetupGrade } from "./types";

// Deterministic PRNG so demo data is stable across restarts (no external deps).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STRATEGIES = ["Breakout", "Trend Continuation", "Reversal", "Range Play", "News Trade"];
const SETUP_GRADES: SetupGrade[] = ["A+", "A", "B", "C"];
const EMOTION_POOL = ["Confident", "Calm", "Fearful", "Greedy", "Impatient", "FOMO", "Frustrated", "Disciplined"];

const DEMO_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "AUDUSD", "GBPJPY", "USDCAD", "EURJPY"];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export async function seedDemoDataIfNeeded() {
  if ((await tradeCount()) > 0) return;

  const account = await ensureDefaultAccount();
  const rand = mulberry32(42);
  let balance = account.startingBalance;

  const now = Date.now();
  const totalTrades = 42;
  const timestamps: number[] = [];
  for (let i = 0; i < totalTrades; i++) {
    const daysAgo = Math.floor((totalTrades - i) * (95 / totalTrades) + rand() * 1.5);
    timestamps.push(now - daysAgo * 24 * 60 * 60 * 1000);
  }

  for (let i = 0; i < totalTrades; i++) {
    const instrument = pick(rand, DEMO_PAIRS);
    const meta = INSTRUMENTS.find((x) => x.symbol === instrument)!;
    const direction: Direction = rand() > 0.48 ? "long" : "short";
    const entryTime = new Date(timestamps[i]);
    const holdHours = 2 + rand() * 46;
    const exitTime = new Date(entryTime.getTime() + holdHours * 60 * 60 * 1000);

    const basePrice = instrument === "XAUUSD" ? 2350 + rand() * 150 : instrument.includes("JPY") ? 150 + rand() * 10 : 1 + rand() * 0.6;
    const pip = meta.pipSize;
    const stopPips = 15 + rand() * 35;
    const riskPercent = 0.25 + rand() * 0.75;
    const riskAmount = balance * (riskPercent / 100);

    const winProbability = 0.5;
    const isWin = rand() < winProbability;
    const plannedRRTarget = 1.2 + rand() * 1.6;

    const entryPrice = basePrice;
    const stopLoss = direction === "long" ? entryPrice - stopPips * pip : entryPrice + stopPips * pip;
    const takeProfit = direction === "long" ? entryPrice + stopPips * pip * plannedRRTarget : entryPrice - stopPips * pip * plannedRRTarget;

    let exitPrice: number;
    let actualRMultiple: number;
    if (isWin) {
      actualRMultiple = plannedRRTarget * (0.35 + rand() * 0.55);
      exitPrice = direction === "long" ? entryPrice + stopPips * pip * actualRMultiple : entryPrice - stopPips * pip * actualRMultiple;
    } else if (rand() < 0.12) {
      actualRMultiple = 0;
      exitPrice = entryPrice;
    } else {
      actualRMultiple = -(0.5 + rand() * 0.6);
      exitPrice = direction === "long" ? entryPrice + stopPips * pip * actualRMultiple : entryPrice - stopPips * pip * actualRMultiple;
    }

    // Position size is derived from risk amount and stop distance (as a real
    // risk-based sizing model would), so the realized P&L the server computes
    // from entry/exit/size lines up with the intended actualRMultiple above.
    const positionSize = Math.round(riskAmount / (stopPips * pip));
    const followedPlan = rand() > 0.22;
    const emotions = [pick(rand, EMOTION_POOL)];
    if (rand() > 0.7) emotions.push(pick(rand, EMOTION_POOL));

    const trade = await createTrade({
      accountId: account.id,
      isDemo: true,
      instrument,
      direction,
      entryTime: entryTime.toISOString(),
      exitTime: exitTime.toISOString(),
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      positionSize,
      accountBalanceAtEntry: balance,
      riskPercent,
      riskAmount,
      fees: Math.round(rand() * 3 * 100) / 100,
      commission: Math.round(rand() * 2 * 100) / 100,
      swap: Math.round((rand() - 0.5) * 4 * 100) / 100,
      status: "closed",
      strategy: pick(rand, STRATEGIES),
      setupGrade: pick(rand, SETUP_GRADES),
      followedPlan,
      emotionTags: emotions,
      customTags: [],
      preTrade: {
        entryReason: "Price reacted off a key level with confirmation from the higher timeframe trend.",
        fundamentalBias: rand() > 0.5 ? "Bullish macro bias from recent data releases." : "Neutral-to-bearish macro backdrop.",
        technicalConfirmation: "Clean break of structure with volume confirmation on the entry timeframe.",
        thesis: "Continuation of the dominant trend after a healthy pullback into demand/supply.",
        invalidation: "A close back through the stop-loss level invalidates the setup.",
      },
      duringTrade: {
        feelings: followedPlan ? "Calm and focused, let the trade play out per plan." : "Felt anxious and considered moving the stop early.",
        followedPlan,
        movedStopLoss: !followedPlan && rand() > 0.5,
        emotions,
      },
      postTrade: {
        wentWell: isWin ? "Entry timing and patience waiting for confirmation." : "Risk was sized correctly even though the trade lost.",
        wentWrong: isWin ? "Could have held slightly longer for extra R." : "Entered slightly early before full confirmation.",
        lessonLearned: "Stick to the checklist and avoid chasing price after missing the first entry.",
        wouldRepeat: isWin || rand() > 0.3,
        improvement: "Wait for the retest before entering next time.",
      },
    });

    balance = trade.accountBalanceAtEntry + (trade.realizedPnl ?? 0);
  }
}

export async function clearDemoData() {
  await deleteAllDemoTrades();
}
