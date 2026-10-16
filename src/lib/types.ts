export type Direction = "long" | "short";
export type TradeStatus = "open" | "closed" | "cancelled";
export type TradeResult = "win" | "loss" | "breakeven" | null;
export type SetupGrade = "A+" | "A" | "B" | "C" | null;
export type AccountType = "personal" | "prop_firm";

export const EMOTION_TAGS = [
  "Confident",
  "Calm",
  "Fearful",
  "Greedy",
  "Impatient",
  "FOMO",
  "Frustrated",
  "Disciplined",
  "Revenge Trading",
] as const;

export type EmotionTag = (typeof EMOTION_TAGS)[number] | string;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  baseCurrency: string;
  startingBalance: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Screenshot {
  id: string;
  tradeId: string;
  phase: "before" | "during" | "after";
  filePath: string;
  originalName: string;
  createdAt: string;
}

export interface PreTradeNotes {
  entryReason: string;
  fundamentalBias: string;
  technicalConfirmation: string;
  thesis: string;
  invalidation: string;
}

export interface DuringTradeNotes {
  feelings: string;
  followedPlan: boolean;
  movedStopLoss: boolean;
  emotions: EmotionTag[];
}

export interface PostTradeNotes {
  wentWell: string;
  wentWrong: string;
  lessonLearned: string;
  wouldRepeat: boolean | null;
  improvement: string;
}

export interface Trade {
  id: string;
  accountId: string;
  isDemo: boolean;
  instrument: string;
  direction: Direction;
  entryTime: string;
  exitTime: string | null;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  exitPrice: number | null;
  positionSize: number;
  accountBalanceAtEntry: number;
  riskPercent: number | null;
  riskAmount: number | null;
  fees: number;
  commission: number;
  swap: number;
  status: TradeStatus;
  result: TradeResult;
  realizedPnl: number | null;
  plannedRR: number | null;
  actualR: number | null;
  /** Maximum adverse excursion — the worst the trade moved against the
   * position before its final result, in pips (or the instrument's natural
   * unit). Manually entered; null means not recorded, never 0. */
  maxDrawdownPips: number | null;
  strategy: string | null;
  setupGrade: SetupGrade;
  followedPlan: boolean;
  emotionTags: EmotionTag[];
  customTags: string[];
  preTrade: PreTradeNotes;
  duringTrade: DuringTradeNotes;
  postTrade: PostTradeNotes;
  screenshots: Screenshot[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  baseCurrency: string;
  timezone: string;
  defaultAccountId: string | null;
  defaultRiskPercent: number;
  strategies: string[];
  customTags: string[];
  showDemoData: boolean;
}

export interface WeeklyReview {
  id: string;
  weekStart: string;
  wins: string;
  mistakes: string;
  lessons: string;
  goalForNextWeek: string;
  createdAt: string;
}

export interface MonthlyReview {
  id: string;
  monthStart: string;
  summary: string;
  lessons: string;
  goalForNextMonth: string;
  createdAt: string;
}

export interface MistakeEntry {
  id: string;
  title: string;
  description: string;
  relatedTradeId: string | null;
  tag: string;
  createdAt: string;
}
