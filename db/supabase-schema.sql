-- Supabase/Postgres schema mirroring the local SQLite schema in src/lib/db.ts.
-- Run this in the Supabase SQL editor when you're ready to move off local storage.
-- See README.md "Migrating to Supabase" for the adapter swap.

create extension if not exists "pgcrypto";

create table accounts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'personal' check (type in ('personal', 'prop_firm')),
  base_currency text not null default 'EUR',
  starting_balance numeric not null default 10000,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table trades (
  id text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  owner uuid not null references auth.users(id) on delete cascade,
  is_demo boolean not null default false,
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  entry_time timestamptz not null,
  exit_time timestamptz,
  entry_price numeric not null,
  stop_loss numeric,
  take_profit numeric,
  exit_price numeric,
  position_size numeric not null,
  account_balance_at_entry numeric not null,
  risk_percent numeric,
  risk_amount numeric,
  fees numeric not null default 0,
  commission numeric not null default 0,
  swap numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  result text check (result in ('win', 'loss', 'breakeven')),
  realized_pnl numeric,
  planned_rr numeric,
  actual_r numeric,
  max_drawdown_pips numeric, -- manually entered maximum adverse excursion, in pips (or the instrument's natural unit)
  strategy text,
  setup_grade text check (setup_grade in ('A+', 'A', 'B', 'C')),
  followed_plan boolean not null default true,
  emotion_tags jsonb not null default '[]',
  custom_tags jsonb not null default '[]',
  pre_trade jsonb not null default '{}',
  during_trade jsonb not null default '{}',
  post_trade jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_trades_account on trades(account_id);
create index idx_trades_exit_time on trades(exit_time);
create index idx_trades_status on trades(status);

create table screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id text not null references trades(id) on delete cascade,
  owner uuid not null references auth.users(id) on delete cascade,
  phase text not null check (phase in ('before', 'during', 'after')),
  storage_path text not null, -- path inside the 'trade-screenshots' storage bucket
  original_name text not null,
  created_at timestamptz not null default now()
);

create table settings (
  owner uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'EUR',
  timezone text not null default 'Europe/Amsterdam',
  default_account_id uuid,
  default_risk_percent numeric not null default 1,
  strategies jsonb not null default '[]',
  custom_tags jsonb not null default '[]',
  show_demo_data boolean not null default true
);

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  wins text not null default '',
  mistakes text not null default '',
  lessons text not null default '',
  goal_for_next_week text not null default '',
  created_at timestamptz not null default now()
);

create table monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  summary text not null default '',
  lessons text not null default '',
  goal_for_next_month text not null default '',
  created_at timestamptz not null default now()
);

create table mistakes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  related_trade_id text,
  tag text not null default '',
  created_at timestamptz not null default now()
);

-- Row Level Security: every table is owner-scoped so only the authenticated
-- user can read/write their own rows.
alter table accounts enable row level security;
alter table trades enable row level security;
alter table screenshots enable row level security;
alter table settings enable row level security;
alter table weekly_reviews enable row level security;
alter table monthly_reviews enable row level security;
alter table mistakes enable row level security;

create policy "owner full access" on accounts for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner full access" on trades for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner full access" on screenshots for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner full access" on settings for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner full access" on weekly_reviews for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner full access" on monthly_reviews for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner full access" on mistakes for all using (owner = auth.uid()) with check (owner = auth.uid());

-- This project has no default privilege grants for anon/authenticated/
-- service_role on new tables (confirmed against the live project: PostgREST
-- returns 42501 "permission denied" rather than evaluating RLS at all
-- without these). RLS bypass and basic table grants are independent in
-- Postgres — even service_role's RLS-bypass attribute doesn't substitute
-- for a GRANT. RLS policies above are the real per-row security boundary
-- for ordinary users; these GRANTs just let a role reach that boundary in
-- the first place. anon gets nothing — every route in this app requires a
-- session. service_role (which bypasses RLS) is only ever used locally by
-- scripts/migrate-to-supabase.ts, never by the deployed app.
grant select, insert, update, delete on accounts, trades, screenshots, settings, weekly_reviews, monthly_reviews, mistakes to authenticated, service_role;
grant usage, select on sequence trade_id_seq to authenticated, service_role;

-- Atomic, concurrency-safe generator for human-readable trade ids (TJ-00001, TJ-00002, ...).
-- Replaces the SQLite app-side "SELECT COUNT(*)+1" approach, which is not safe under
-- concurrent writes. Called from the app via `supabase.rpc('next_trade_id')`.
create sequence if not exists trade_id_seq;

create or replace function next_trade_id()
returns text
language sql
as $$
  select 'TJ-' || lpad(nextval('trade_id_seq')::text, 5, '0');
$$;
revoke execute on function next_trade_id() from public, anon;
grant execute on function next_trade_id() to authenticated;

-- Lets the one-off migration script (scripts/migrate-to-supabase.ts, run with
-- the service-role key) advance the sequence past whatever trade ids it just
-- imported, so newly created trades don't collide with migrated ones.
-- Restricted to service_role — never callable by a logged-in user.
create or replace function admin_set_trade_id_seq(value bigint)
returns void
language sql
security definer
as $$
  select setval('trade_id_seq', value);
$$;
revoke execute on function admin_set_trade_id_seq(bigint) from public, anon, authenticated;
grant execute on function admin_set_trade_id_seq(bigint) to service_role;

-- Storage: private bucket for trade screenshots. Screenshots are uploaded under
-- `${auth.uid()}/${tradeId}/${filename}` and served via short-lived signed URLs —
-- the bucket itself is never public, and these policies key off the first path
-- segment so a user can only read/write/delete objects under their own uuid.
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', false)
on conflict (id) do nothing;

create policy "owner read own screenshots"
  on storage.objects for select
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner upload own screenshots"
  on storage.objects for insert
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner update own screenshots"
  on storage.objects for update
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner delete own screenshots"
  on storage.objects for delete
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
