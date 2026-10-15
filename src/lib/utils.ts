import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency: string = "EUR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, digits: number = 2) {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "" : ""}${value.toFixed(digits)}%`;
}

export function formatR(value: number | null | undefined, digits: number = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}R`;
}

export function formatNumber(value: number, digits: number = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function generateTradeId(sequence: number) {
  return `TJ-${String(sequence).padStart(5, "0")}`;
}
