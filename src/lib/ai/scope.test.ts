import { describe, it, expect } from "vitest";
import { resolveAccountScope } from "./scope";
import type { Account } from "@/lib/types";

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: "acc-1",
    name: "Personal",
    type: "personal",
    baseCurrency: "EUR",
    startingBalance: 10000,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveAccountScope — account isolation", () => {
  it("rejects when the user has no accounts at all", () => {
    const result = resolveAccountScope([], { accountId: "acc-1" });
    expect(result.ok).toBe(false);
  });

  it("resolves to exactly the requested account when it belongs to this user", () => {
    const accounts = [makeAccount({ id: "acc-1" }), makeAccount({ id: "acc-2", isDefault: false })];
    const result = resolveAccountScope(accounts, { accountId: "acc-2" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope.accountId).toBe("acc-2");
      expect(result.scope.aggregated).toBe(false);
      expect(result.scope.accountIds).toEqual(["acc-2"]);
    }
  });

  it("rejects an accountId that is not in this user's own account list — the core isolation guarantee", () => {
    const accounts = [makeAccount({ id: "acc-1" })];
    const result = resolveAccountScope(accounts, { accountId: "someone-elses-account-id" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing accountId when not aggregated", () => {
    const accounts = [makeAccount({ id: "acc-1" })];
    const result = resolveAccountScope(accounts, {});
    expect(result.ok).toBe(false);
  });

  it("aggregated scope spans exactly this user's own accounts, nothing else", () => {
    const accounts = [makeAccount({ id: "acc-1" }), makeAccount({ id: "acc-2", isDefault: false })];
    const result = resolveAccountScope(accounts, { aggregated: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope.accountId).toBeNull();
      expect(result.scope.aggregated).toBe(true);
      expect(result.scope.accountIds.sort()).toEqual(["acc-1", "acc-2"]);
    }
  });

  it("aggregated takes precedence over an accountId if both are somehow sent", () => {
    const accounts = [makeAccount({ id: "acc-1" })];
    const result = resolveAccountScope(accounts, { aggregated: true, accountId: "acc-1" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scope.aggregated).toBe(true);
  });
});
