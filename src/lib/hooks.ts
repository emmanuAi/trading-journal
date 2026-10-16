"use client";
import useSWR from "swr";
import type { Trade, Settings } from "./types";
import { useAccountContext } from "@/components/layout/account-context";

export async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load data.");
  return res.json();
}

export interface TradeQuery {
  dateFrom?: string;
  dateTo?: string;
  instrument?: string;
  result?: string;
  direction?: string;
  strategy?: string;
  emotion?: string;
  followedPlan?: string;
  status?: string;
  search?: string;
  includeDemo?: boolean;
}

function buildQuery(params: Record<string, string | undefined | boolean>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}

/** Cached per unique (account, filters) combination via SWR — navigating away
 * and back to a page using the same query shows the cached result instantly
 * while a revalidation request runs in the background, instead of always
 * re-fetching from a blank slate. revalidateOnFocus is off since trading
 * data doesn't need a refetch every time the browser tab regains focus. */
export function useTrades(filters: TradeQuery = {}) {
  const { activeAccountId, aggregated, loading: accountLoading } = useAccountContext();
  const filterKey = JSON.stringify(filters);

  const ready = !accountLoading && (aggregated || !!activeAccountId);
  const key = ready
    ? `/api/trades?${buildQuery({
        accountId: activeAccountId ?? undefined,
        aggregated,
        ...(JSON.parse(filterKey) as Record<string, string | boolean | undefined>),
      })}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<{ trades: Trade[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    trades: data?.trades ?? [],
    loading: accountLoading || (key !== null && isLoading),
    error: error ? (error instanceof Error ? error.message : "Failed to load trades.") : null,
    refresh: () => mutate(),
  };
}

export function useSettings() {
  const { data, isLoading, mutate } = useSWR<{ settings: Settings }>("/api/settings", fetcher, {
    revalidateOnFocus: false,
  });

  return {
    settings: data?.settings ?? null,
    loading: isLoading,
    refresh: () => mutate(),
  };
}
