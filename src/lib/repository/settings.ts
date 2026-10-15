import { createClient, requireUser } from "../supabase/server";
import type { Settings } from "../types";

interface SettingsRow {
  base_currency: string;
  timezone: string;
  default_account_id: string | null;
  default_risk_percent: number;
  strategies: string[];
  custom_tags: string[];
  show_demo_data: boolean;
}

const DEFAULT_STRATEGIES = ["Breakout", "Trend Continuation", "Reversal", "Range Play", "News Trade"];

function rowToSettings(row: SettingsRow): Settings {
  return {
    baseCurrency: row.base_currency,
    timezone: row.timezone,
    defaultAccountId: row.default_account_id,
    defaultRiskPercent: row.default_risk_percent,
    strategies: row.strategies ?? [],
    customTags: row.custom_tags ?? [],
    showDemoData: row.show_demo_data,
  };
}

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data, error } = await supabase.from("settings").select("*").eq("owner", user.id).maybeSingle();
  if (error) throw error;
  if (data) return rowToSettings(data as SettingsRow);

  // First request for this owner — create their default settings row.
  const { data: created, error: insertError } = await supabase
    .from("settings")
    .insert({
      owner: user.id,
      base_currency: "EUR",
      timezone: "Europe/Amsterdam",
      default_account_id: null,
      default_risk_percent: 1,
      strategies: DEFAULT_STRATEGIES,
      custom_tags: [],
      show_demo_data: true,
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return rowToSettings(created as SettingsRow);
}

export async function updateSettings(input: Partial<Settings>): Promise<Settings> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const current = await getSettings();
  const next: Settings = { ...current, ...input };

  const { data, error } = await supabase
    .from("settings")
    .update({
      base_currency: next.baseCurrency,
      timezone: next.timezone,
      default_account_id: next.defaultAccountId,
      default_risk_percent: next.defaultRiskPercent,
      strategies: next.strategies,
      custom_tags: next.customTags,
      show_demo_data: next.showDemoData,
    })
    .eq("owner", user.id)
    .select()
    .single();
  if (error) throw error;
  return rowToSettings(data as SettingsRow);
}
