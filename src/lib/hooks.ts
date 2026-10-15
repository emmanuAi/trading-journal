"use client";
import * as React from "react";
import type { Trade, Settings } from "./types";
import { useAccountContext } from "@/components/layout/account-context";

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

export function useTrades(filters: TradeQuery = {}) {
  const { activeAccountId, aggregated, loading: accountLoading } = useAccountContext();
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const filterKey = JSON.stringify(filters);

  const refresh = React.useCallback(async () => {
    if (accountLoading) return;
    if (!aggregated && !activeAccountId) {
      setTrades([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery({
        accountId: activeAccountId ?? undefined,
        aggregated,
        ...(JSON.parse(filterKey) as Record<string, string | boolean | undefined>),
      });
      const res = await fetch(`/api/trades?${query}`);
      if (!res.ok) throw new Error("Failed to load trades.");
      const data = await res.json();
      setTrades(data.trades);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trades.");
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, aggregated, accountLoading, filterKey]);

  React.useEffect(() => {
    // Fetch-on-mount/dep-change: refresh() is the external data sync, not a derived value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { trades, loading, error, refresh };
}

export function useSettings() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data.settings);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { settings, loading, refresh };
}
