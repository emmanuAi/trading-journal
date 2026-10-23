-- AI Trading Coach — Phase 2 schema migration
-- Additive only: creates 5 new tables, their indexes/RLS/grants, and 6 new
-- security-definer functions. Touches nothing in db/supabase-schema.sql.
-- Reviewed and hardened across three passes — see
-- C:\Users\safar\.claude\plans\logical-weaving-candy.md for the full
-- design rationale. Run this once in the Supabase SQL Editor.

-- ============================================================
-- 1. Chat threads
-- ============================================================
create table coach_conversations (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_coach_conversations_owner on coach_conversations(owner, updated_at desc);

-- ============================================================
-- 2. Chat messages
-- ============================================================
create table coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references coach_conversations(id) on delete cascade,
  owner uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_coach_messages_conversation on coach_messages(conversation_id, created_at);
create index idx_coach_messages_owner on coach_messages(owner, created_at);

-- ============================================================
-- 3. Weekly reports
-- ============================================================
create table ai_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  week_start date not null,
  week_end date not null,
  stats_snapshot jsonb not null,
  summary_text text not null,
  model_used text not null,
  trades_count int not null,
  created_at timestamptz not null default now(),
  unique (owner, account_id, week_start)
);

create index idx_ai_weekly_reports_owner on ai_weekly_reports(owner, week_start desc);
create unique index idx_ai_weekly_reports_unique_null_account on ai_weekly_reports(owner, week_start) where account_id is null;

-- ============================================================
-- 4. Usage log
-- ============================================================
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('chat_message', 'weekly_report')),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed', 'rejected')),
  estimated_usd numeric not null default 0,
  actual_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_log_owner_kind on ai_usage_log(owner, kind, created_at);

-- ============================================================
-- 5. Budget ledger — one row per UTC calendar month, app-wide total.
-- No grant/policy of any kind for `authenticated`.
-- ============================================================
create table ai_budget_ledger (
  period_start date primary key,
  estimated_usd numeric not null default 0,
  actual_usd numeric not null default 0,
  warned_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table coach_conversations enable row level security;
alter table coach_messages enable row level security;
alter table ai_weekly_reports enable row level security;
alter table ai_usage_log enable row level security;
alter table ai_budget_ledger enable row level security;

create policy "owner full access" on coach_conversations
  for all
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.owner = auth.uid()))
  );

create policy "owner full access" on coach_messages
  for all
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and exists (select 1 from coach_conversations c where c.id = conversation_id and c.owner = auth.uid())
  );

create policy "owner full access" on ai_weekly_reports
  for all
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.owner = auth.uid()))
  );

create policy "owner can read own usage log" on ai_usage_log
  for select using (owner = auth.uid());

-- ai_budget_ledger: intentionally no policy at all for authenticated.

grant select, insert, update, delete on coach_conversations, coach_messages, ai_weekly_reports to authenticated, service_role;
grant select on ai_usage_log to authenticated;
grant select, insert, update, delete on ai_usage_log, ai_budget_ledger to service_role;

-- ============================================================
-- Budget functions — self-service pair (authenticated, scoped to auth.uid())
-- ============================================================
create or replace function reserve_ai_spend(p_kind text, p_estimated_usd numeric, p_cap_usd numeric default 5.00)
returns table (log_id uuid, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_log_id uuid;
  v_allowed boolean := false;
  v_max_single_call_usd constant numeric := 1.00;
begin
  if v_owner is null then
    raise exception 'reserve_ai_spend: no authenticated user';
  end if;

  if p_estimated_usd is null or p_estimated_usd <= 0 or p_estimated_usd > v_max_single_call_usd then
    raise exception 'reserve_ai_spend: p_estimated_usd out of allowed range (0, %]', v_max_single_call_usd;
  end if;

  insert into ai_budget_ledger (period_start) values (v_period) on conflict (period_start) do nothing;

  update ai_budget_ledger
  set estimated_usd = estimated_usd + p_estimated_usd, updated_at = now()
  where period_start = v_period
    and estimated_usd + actual_usd + p_estimated_usd <= p_cap_usd;

  v_allowed := (found);

  insert into ai_usage_log (owner, kind, status, estimated_usd)
  values (v_owner, p_kind, case when v_allowed then 'reserved' else 'rejected' end, case when v_allowed then p_estimated_usd else 0 end)
  returning id into v_log_id;

  return query select v_log_id, v_allowed;
end;
$$;

create or replace function reconcile_ai_spend(p_log_id uuid, p_actual_usd numeric, p_warn_usd numeric default 4.00)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_estimated_usd numeric;
  v_max_single_call_usd constant numeric := 1.00;
begin
  if v_owner is null then
    raise exception 'reconcile_ai_spend: no authenticated user';
  end if;

  if p_actual_usd is null or p_actual_usd < 0 or p_actual_usd > v_max_single_call_usd then
    raise exception 'reconcile_ai_spend: p_actual_usd out of allowed range [0, %]', v_max_single_call_usd;
  end if;

  update ai_usage_log
  set status = case when p_actual_usd > 0 then 'completed' else 'failed' end,
      actual_usd = p_actual_usd
  where id = p_log_id and owner = v_owner and status = 'reserved'
  returning estimated_usd into v_estimated_usd;

  if v_estimated_usd is null then
    return;
  end if;

  update ai_budget_ledger
  set estimated_usd = greatest(estimated_usd - v_estimated_usd, 0),
      actual_usd = actual_usd + p_actual_usd,
      warned_at = case when warned_at is null and actual_usd + p_actual_usd >= p_warn_usd then now() else warned_at end,
      updated_at = now()
  where period_start = v_period;
end;
$$;

revoke execute on function reserve_ai_spend(text, numeric, numeric) from public, anon;
revoke execute on function reconcile_ai_spend(uuid, numeric, numeric) from public, anon;
grant execute on function reserve_ai_spend(text, numeric, numeric) to authenticated;
grant execute on function reconcile_ai_spend(uuid, numeric, numeric) to authenticated;

-- ============================================================
-- Budget functions — service_role-only pair, explicit owner param
-- ============================================================
create or replace function reserve_ai_spend_for_owner(p_owner uuid, p_kind text, p_estimated_usd numeric, p_cap_usd numeric default 5.00)
returns table (log_id uuid, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_log_id uuid;
  v_allowed boolean := false;
  v_max_single_call_usd constant numeric := 1.00;
begin
  if p_estimated_usd is null or p_estimated_usd <= 0 or p_estimated_usd > v_max_single_call_usd then
    raise exception 'reserve_ai_spend_for_owner: p_estimated_usd out of allowed range (0, %]', v_max_single_call_usd;
  end if;

  insert into ai_budget_ledger (period_start) values (v_period) on conflict (period_start) do nothing;

  update ai_budget_ledger
  set estimated_usd = estimated_usd + p_estimated_usd, updated_at = now()
  where period_start = v_period
    and estimated_usd + actual_usd + p_estimated_usd <= p_cap_usd;

  v_allowed := (found);

  insert into ai_usage_log (owner, kind, status, estimated_usd)
  values (p_owner, p_kind, case when v_allowed then 'reserved' else 'rejected' end, case when v_allowed then p_estimated_usd else 0 end)
  returning id into v_log_id;

  return query select v_log_id, v_allowed;
end;
$$;

create or replace function reconcile_ai_spend_for_owner(p_owner uuid, p_log_id uuid, p_actual_usd numeric, p_warn_usd numeric default 4.00)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_estimated_usd numeric;
  v_max_single_call_usd constant numeric := 1.00;
begin
  if p_actual_usd is null or p_actual_usd < 0 or p_actual_usd > v_max_single_call_usd then
    raise exception 'reconcile_ai_spend_for_owner: p_actual_usd out of allowed range [0, %]', v_max_single_call_usd;
  end if;

  update ai_usage_log
  set status = case when p_actual_usd > 0 then 'completed' else 'failed' end,
      actual_usd = p_actual_usd
  where id = p_log_id and owner = p_owner and status = 'reserved'
  returning estimated_usd into v_estimated_usd;

  if v_estimated_usd is null then
    return;
  end if;

  update ai_budget_ledger
  set estimated_usd = greatest(estimated_usd - v_estimated_usd, 0),
      actual_usd = actual_usd + p_actual_usd,
      warned_at = case when warned_at is null and actual_usd + p_actual_usd >= p_warn_usd then now() else warned_at end,
      updated_at = now()
  where period_start = v_period;
end;
$$;

revoke execute on function reserve_ai_spend_for_owner(uuid, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function reconcile_ai_spend_for_owner(uuid, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function reserve_ai_spend_for_owner(uuid, text, numeric, numeric) to service_role;
grant execute on function reconcile_ai_spend_for_owner(uuid, uuid, numeric, numeric) to service_role;

-- ============================================================
-- Minimal budget status — the only read surface for the global ledger
-- ============================================================
create or replace function get_ai_budget_status()
returns table (status text, percent_used int, warning boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_cap_usd constant numeric := 5.00;
  v_warn_usd constant numeric := 4.00;
  v_total numeric := 0;
begin
  select coalesce(estimated_usd, 0) + coalesce(actual_usd, 0) into v_total
  from ai_budget_ledger
  where period_start = v_period;

  v_total := coalesce(v_total, 0);

  return query select
    case
      when v_total >= v_cap_usd then 'exhausted'
      when v_total >= v_warn_usd then 'warning'
      else 'ok'
    end,
    least(100, floor((v_total / v_cap_usd) * 100))::int,
    v_total >= v_warn_usd;
end;
$$;

revoke execute on function get_ai_budget_status() from public, anon;
grant execute on function get_ai_budget_status() to authenticated;
