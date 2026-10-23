import type { Account } from "@/lib/types";

export interface CoachScope {
  /** null means aggregated across every account the owner has. */
  accountId: string | null;
  aggregated: boolean;
  accountIds: string[];
}

export type ScopeResult = { ok: true; scope: CoachScope } | { ok: false; error: string };

/** Resolves what the coach is allowed to see for this request, from the
 * caller's own account list only — never trusts an account id the caller
 * didn't already have in their own `accounts` (which is itself owner-scoped
 * by RLS). This is the enforcement point for "restrict trade context to
 * the signed-in user and currently selected trading account": an id that
 * isn't in `accounts` is rejected here before any tool ever runs, so the
 * model has no path to another owner's data regardless of what it asks for. */
export function resolveAccountScope(accounts: Account[], requested: { accountId?: string | null; aggregated?: boolean }): ScopeResult {
  if (accounts.length === 0) {
    return { ok: false, error: "No trading accounts found for this user." };
  }

  if (requested.aggregated) {
    return { ok: true, scope: { accountId: null, aggregated: true, accountIds: accounts.map((a) => a.id) } };
  }

  const accountId = requested.accountId;
  if (!accountId || typeof accountId !== "string") {
    return { ok: false, error: "accountId is required when aggregated is not set." };
  }

  const match = accounts.find((a) => a.id === accountId);
  if (!match) {
    return { ok: false, error: "accountId does not belong to this user." };
  }

  return { ok: true, scope: { accountId: match.id, aggregated: false, accountIds: [match.id] } };
}
