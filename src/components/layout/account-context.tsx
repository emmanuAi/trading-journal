"use client";
import * as React from "react";
import type { Account } from "@/lib/types";

interface AccountContextValue {
  accounts: Account[];
  activeAccountId: string | null;
  aggregated: boolean;
  setActiveAccountId: (id: string) => void;
  setAggregated: (v: boolean) => void;
  refreshAccounts: () => Promise<void>;
  loading: boolean;
}

const AccountContext = React.createContext<AccountContextValue | null>(null);

const STORAGE_KEY = "tj_active_account";
const AGG_KEY = "tj_aggregated_view";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [activeAccountId, setActiveAccountIdState] = React.useState<string | null>(null);
  const [aggregated, setAggregatedState] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const refreshAccounts = React.useCallback(async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    return data.accounts ?? [];
  }, []);

  React.useEffect(() => {
    (async () => {
      const list: Account[] = await refreshAccounts();
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      const storedAgg = typeof window !== "undefined" ? window.localStorage.getItem(AGG_KEY) === "1" : false;
      const valid = list.find((a) => a.id === stored);
      const fallback = list.find((a) => a.isDefault) ?? list[0];
      setActiveAccountIdState(valid ? valid.id : fallback ? fallback.id : null);
      setAggregatedState(storedAgg);
      setLoading(false);
    })();
  }, [refreshAccounts]);

  const setActiveAccountId = (id: string) => {
    setActiveAccountIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  };

  const setAggregated = (v: boolean) => {
    setAggregatedState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(AGG_KEY, v ? "1" : "0");
  };

  return (
    <AccountContext.Provider
      value={{ accounts, activeAccountId, aggregated, setActiveAccountId, setAggregated, refreshAccounts, loading }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext() {
  const ctx = React.useContext(AccountContext);
  if (!ctx) throw new Error("useAccountContext must be used within AccountProvider");
  return ctx;
}
