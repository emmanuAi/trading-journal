import { createClient, requireUser } from "../supabase/server";
import type { Account, AccountType } from "../types";

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  base_currency: string;
  starting_balance: number;
  is_default: boolean;
  created_at: string;
}

export function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    baseCurrency: row.base_currency,
    startingBalance: row.starting_balance,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

export async function listAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("owner", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AccountRow[]).map(rowToAccount);
}

export async function getAccount(id: string): Promise<Account | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).eq("owner", user.id).maybeSingle();
  if (error) throw error;
  return data ? rowToAccount(data as AccountRow) : null;
}

export async function getDefaultAccount(): Promise<Account | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: defaultRow, error: defaultError } = await supabase
    .from("accounts")
    .select("*")
    .eq("owner", user.id)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (defaultError) throw defaultError;
  if (defaultRow) return rowToAccount(defaultRow as AccountRow);

  const { data: firstRow, error: firstError } = await supabase
    .from("accounts")
    .select("*")
    .eq("owner", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstError) throw firstError;
  return firstRow ? rowToAccount(firstRow as AccountRow) : null;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  baseCurrency: string;
  startingBalance: number;
  isDefault?: boolean;
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  if (input.isDefault) {
    const { error } = await supabase.from("accounts").update({ is_default: false }).eq("owner", user.id);
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      owner: user.id,
      name: input.name,
      type: input.type,
      base_currency: input.baseCurrency,
      starting_balance: input.startingBalance,
      is_default: !!input.isDefault,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToAccount(data as AccountRow);
}

export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<Account | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const existing = await getAccount(id);
  if (!existing) return null;

  if (input.isDefault) {
    const { error } = await supabase.from("accounts").update({ is_default: false }).eq("owner", user.id);
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from("accounts")
    .update({
      name: input.name ?? existing.name,
      type: input.type ?? existing.type,
      base_currency: input.baseCurrency ?? existing.baseCurrency,
      starting_balance: input.startingBalance ?? existing.startingBalance,
      is_default: input.isDefault ?? existing.isDefault,
    })
    .eq("id", id)
    .eq("owner", user.id)
    .select()
    .single();
  if (error) throw error;
  return rowToAccount(data as AccountRow);
}

export async function deleteAccount(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("owner", user.id);
  if (error) throw error;
}

export async function ensureDefaultAccount(): Promise<Account> {
  const existing = await getDefaultAccount();
  if (existing) return existing;
  return createAccount({
    name: "Main Account",
    type: "personal",
    baseCurrency: "EUR",
    startingBalance: 10000,
    isDefault: true,
  });
}
