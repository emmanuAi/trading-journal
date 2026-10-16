"use client";
import * as React from "react";
import useSWR from "swr";
import type { Account } from "@/lib/types";
import { fetcher } from "@/lib/hooks";

interface AccountContextValue {
  accounts: Account[];
  activeAccountId: string | null;
  aggregated: boolean;
  setActiveAccountId: (id: string) => void;
  setAggregated: (v: boolean) => void;
  refreshAccounts: () => Promise<Account[]>;
  loading: boolean;
}

const AccountContext = React.createContext<AccountContextValue | null>(null);

const STORAGE_KEY = "tj_active_account";
const AGG_KEY = "tj_aggregated_view";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  // revalidateOnFocus: false — this list rarely changes mid-session and we
  // don't want an extra request every time the browser tab regains focus.
  // Cached between page navigations, so returning to a page that needs the
  // account list no longer re-fetches from scratch.
  const { data, isLoading, mutate } = useSWR<{ accounts: Account[] }>("/api/accounts", fetcher, {
    revalidateOnFocus: false,
  });
  const accounts = React.useMemo(() => data?.accounts ?? [], [data]);

  const [activeAccountId, setActiveAccountIdState] = React.useState<string | null>(null);
  const [aggregated, setAggregatedState] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (isLoading || initialized) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const storedAgg = typeof window !== "undefined" ? window.localStorage.getItem(AGG_KEY) === "1" : false;
    const valid = accounts.find((a) => a.id === stored);
    const fallback = accounts.find((a) => a.isDefault) ?? accounts[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from localStorage + the first resolved account list, not a derived render value.
    setActiveAccountIdState(valid ? valid.id : fallback ? fallback.id : null);
    setAggregatedState(storedAgg);
    setInitialized(true);
  }, [isLoading, accounts, initialized]);

  const refreshAccounts = React.useCallback(async () => {
    const result = await mutate();
    return result?.accounts ?? [];
  }, [mutate]);

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
      value={{
        accounts,
        activeAccountId,
        aggregated,
        setActiveAccountId,
        setAggregated,
        refreshAccounts,
        loading: isLoading || !initialized,
      }}
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
