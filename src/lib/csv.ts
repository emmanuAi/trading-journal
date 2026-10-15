import type { Trade } from "./types";

const COLUMNS = [
  "id",
  "accountId",
  "isDemo",
  "instrument",
  "direction",
  "entryTime",
  "exitTime",
  "entryPrice",
  "stopLoss",
  "takeProfit",
  "exitPrice",
  "positionSize",
  "accountBalanceAtEntry",
  "riskPercent",
  "riskAmount",
  "fees",
  "commission",
  "swap",
  "status",
  "result",
  "realizedPnl",
  "plannedRR",
  "actualR",
  "strategy",
  "setupGrade",
  "followedPlan",
  "emotionTags",
  "customTags",
] as const;

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join("|") : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function tradesToCsv(trades: Trade[]): string {
  const header = COLUMNS.join(",");
  const rows = trades.map((t) => COLUMNS.map((col) => escapeCsvCell((t as unknown as Record<string, unknown>)[col])).join(","));
  return [header, ...rows].join("\n");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") {
        cells.push(current);
        current = "";
      } else current += char;
    }
  }
  cells.push(current);
  return cells;
}

export interface ParsedCsvTrade {
  instrument: string;
  direction: "long" | "short";
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
  status: "open" | "closed" | "cancelled";
  result: "win" | "loss" | "breakeven" | null;
  realizedPnl: number | null;
  plannedRR: number | null;
  actualR: number | null;
  strategy: string | null;
  setupGrade: "A+" | "A" | "B" | "C" | null;
  followedPlan: boolean;
  emotionTags: string[];
  customTags: string[];
  signature: string;
}

function toNumOrNull(v: string): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseCsv(text: string): ParsedCsvTrade[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);

  return rows.map((cells) => {
    const get = (col: string) => {
      const idx = header.indexOf(col);
      return idx >= 0 ? cells[idx] ?? "" : "";
    };

    const instrument = get("instrument").toUpperCase();
    const direction = get("direction").toLowerCase() === "short" ? "short" : "long";
    const entryTime = get("entryTime");
    const entryPrice = Number(get("entryPrice")) || 0;
    const positionSize = Number(get("positionSize")) || 0;

    return {
      instrument,
      direction,
      entryTime,
      exitTime: get("exitTime") || null,
      entryPrice,
      stopLoss: toNumOrNull(get("stopLoss")),
      takeProfit: toNumOrNull(get("takeProfit")),
      exitPrice: toNumOrNull(get("exitPrice")),
      positionSize,
      accountBalanceAtEntry: Number(get("accountBalanceAtEntry")) || 0,
      riskPercent: toNumOrNull(get("riskPercent")),
      riskAmount: toNumOrNull(get("riskAmount")),
      fees: Number(get("fees")) || 0,
      commission: Number(get("commission")) || 0,
      swap: Number(get("swap")) || 0,
      status: (["open", "closed", "cancelled"].includes(get("status")) ? get("status") : "closed") as "open" | "closed" | "cancelled",
      result: (["win", "loss", "breakeven"].includes(get("result")) ? get("result") : null) as "win" | "loss" | "breakeven" | null,
      realizedPnl: toNumOrNull(get("realizedPnl")),
      plannedRR: toNumOrNull(get("plannedRR")),
      actualR: toNumOrNull(get("actualR")),
      strategy: get("strategy") || null,
      setupGrade: (["A+", "A", "B", "C"].includes(get("setupGrade")) ? get("setupGrade") : null) as "A+" | "A" | "B" | "C" | null,
      followedPlan: get("followedPlan") !== "false" && get("followedPlan") !== "0",
      emotionTags: get("emotionTags") ? get("emotionTags").split("|").filter(Boolean) : [],
      customTags: get("customTags") ? get("customTags").split("|").filter(Boolean) : [],
      signature: `${instrument}|${direction}|${entryTime}|${entryPrice}|${positionSize}`,
    };
  });
}
