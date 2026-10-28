-- AI Trading Coach — Phase 6 schema migration (automated weekly reports)
-- Additive only: 2 new columns on existing tables, 1 new table, 2 new
-- security-definer functions. Touches nothing in db/supabase-schema.sql or
-- db/ai-coach-migration.sql. Not run yet — proposal only, pending approval.

-- ============================================================
-- 1. Opt-in preference. Defaults every existing AND new user to OFF —
-- automated reports never start generating for anyone without an explicit
-- action in Settings.
-- ============================================================
alter table settings
  add column auto_weekly_reports_enabled boolean not null default false;

-- ============================================================
-- 2. Distinguish automated from manually-generated reports. Existing rows
-- (all current on-demand reports from Phase 5) correctly default to
-- 'manual' — nothing about their meaning changes.
-- ============================================================
alter table ai_weekly_reports
  add column source text not null default 'manual' check (source in ('manual', 'scheduled'));

-- ============================================================
-- 3. Cron run lease — makes the daily batch resumable and prevents two
-- overlapping/duplicate cron deliveries (Vercel's own docs: "cron delivery
-- can occasionally invoke the same scheduled run more than once") from
-- doing the same week's work, and therefore the same AI spend, twice.
--
-- One row per (job_name, period_start). period_start here is the cron
-- job's own UTC-anchored bookkeeping key for "which week's batch is this",
-- NOT any individual user's report week_start (each user's own report
-- week is computed separately, in their own settings.timezone).
--
-- status: 'running' means either actively claimed by a live invocation
-- (if lease_expires_at is still in the future) or left resumable after an
-- invocation voluntarily stopped early with unfinished work (if the lease
-- has expired) — claim_cron_lease tells these apart by checking
-- lease_expires_at, never by status alone. 'completed' means every opted-in
-- user was processed (generated, skipped as already-done, or skipped as
-- empty-week) in some combination of attempts. 'failed' means the attempt
-- ceiling was reached while unfinished work remained — auto-retries stop;
-- affected users can still be generated manually via the Phase 5 UI.
-- ============================================================
create table cron_runs (
  job_name text not null,
  period_start date not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  lease_expires_at timestamptz not null,
  attempt_count int not null default 1,
  processed_count int not null default 0,
  skipped_count int not null default 0,
  failed_count int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (job_name, period_start)
);

alter table cron_runs enable row level security;
-- No policy for authenticated at all — service_role only, same pattern as
-- ai_budget_ledger. No end-user client has any reason to see this table.
-- Includes delete (unlike the cron job's own normal operation, which never
-- deletes a row) purely for operability — so a stray/stuck row can be
-- cleared by hand via service_role without needing a separate migration.
-- This adds no security exposure: service_role already bypasses RLS
-- everywhere: the real boundary enforced here is excluding
-- authenticated/anon entirely, which this grant still does.
grant select, insert, update, delete on cron_runs to service_role;

-- ============================================================
-- Budget-style grant for the two columns this migration adds. authenticated
-- already has update on settings and select on ai_weekly_reports from the
-- existing grants in db/supabase-schema.sql and db/ai-coach-migration.sql
-- (grant ... is column-agnostic in Postgres — a new column on an already-
-- granted table is automatically covered, no new grant statement needed
-- here). Nothing to add for either altered table.
-- ============================================================

-- ============================================================
-- claim_cron_lease — the atomic claim/reclaim operation. Mirrors the
-- reserve_ai_spend security-definer pattern from the Phase 2 migration:
-- the whole decision happens inside one function call so there's no
-- read-then-write race between two concurrent invocations.
--
-- Three outcomes:
--  1. No row yet for this period -> fresh claim, attempt 1.
--  2. Row exists, status is 'completed' or 'failed' -> not claimable,
--     reported back as such (no state change).
--  3. Row exists, status 'running':
--     a. lease_expires_at is still in the future -> actively held by a
--        live invocation, not claimable (no state change).
--     b. lease_expires_at has passed (stale) and attempt_count is already
--        at the ceiling -> transitions to 'failed' right here (this is the
--        ONE place that decision is made) and reports not claimable.
--     c. lease_expires_at has passed and attempt_count is under the
--        ceiling -> reclaimed: lease extended, attempt_count incremented,
--        claimable.
-- ============================================================
-- Security-review note: an earlier draft of this function split the reclaim
-- check into a SELECT (read staleness/ceiling into PL/pgSQL variables) and
-- a separate, unconditional-on-those-variables UPDATE. That is NOT atomic:
-- two concurrent invocations could both pass the SELECT-time check before
-- either one's UPDATE committed, and Postgres would then apply BOTH
-- UPDATEs in sequence (merely serialized, not mutually exclusive) — both
-- would see claimed=true and both would go on to process the same owners,
-- defeating the lock's entire purpose (duplicate AI calls, double spend).
-- The version below bakes the full condition (status/staleness/ceiling)
-- directly into the UPDATE's own WHERE clause, so it is re-evaluated
-- against the row's CURRENT state at the moment each UPDATE actually
-- acquires the row lock — only the first of two concurrent attempts can
-- ever match; the second's WHERE clause fails against the now-updated row
-- and affects zero rows.
-- Live-verification note: an earlier version of this function left every
-- column reference inside the body unqualified (e.g. bare `status`,
-- `attempt_count`). That broke in production with "column reference
-- 'status' is ambiguous" — `returns table (claimed boolean, attempt_count
-- int, status text)` implicitly declares `attempt_count` and `status` as
-- PL/pgSQL variables in the function's own scope, and cron_runs ALSO has
-- columns with those exact names, so every bare reference inside a query
-- against cron_runs collided with the function's own output parameters.
-- Fixed by giving cron_runs an explicit alias (cr) and qualifying every
-- single column reference to it throughout the function — never relying on
-- an unqualified name to resolve to the table rather than an OUT param.
create or replace function claim_cron_lease(p_job_name text, p_period_start date, p_lease_seconds int default 360, p_max_attempts int default 5)
returns table (claimed boolean, attempt_count int, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_attempt int;
begin
  -- Fresh claim: atomicity comes from the table's own primary key via
  -- ON CONFLICT DO NOTHING — only one concurrent INSERT can ever succeed.
  insert into public.cron_runs as cr (job_name, period_start, status, lease_expires_at, attempt_count)
  values (p_job_name, p_period_start, 'running', now() + make_interval(secs => p_lease_seconds), 1)
  on conflict (job_name, period_start) do nothing;

  if found then
    return query select true, 1, 'running';
    return;
  end if;

  -- Reclaim: one atomic, fully self-contained conditional UPDATE — see the
  -- design note further up. Only a row that is still 'running', whose
  -- lease has actually expired, and whose attempt_count is still under the
  -- ceiling AT THE MOMENT THIS UPDATE RUNS can match.
  update public.cron_runs as cr
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = cr.attempt_count + 1,
      updated_at = now()
  where cr.job_name = p_job_name
    and cr.period_start = p_period_start
    and cr.status = 'running'
    and cr.lease_expires_at <= now()
    and cr.attempt_count < p_max_attempts
  returning cr.attempt_count into v_attempt;

  if found then
    return query select true, v_attempt, 'running';
    return;
  end if;

  -- Not claimable. Figure out why, for the caller to log — this read is
  -- purely informational and changes nothing by itself.
  select cr.status, cr.attempt_count into v_status, v_attempt
  from public.cron_runs as cr
  where cr.job_name = p_job_name and cr.period_start = p_period_start;

  -- The ceiling-exhausted -> 'failed' transition is its own atomic,
  -- self-contained conditional UPDATE for the same reason as the reclaim
  -- above. If two invocations reach this branch concurrently, only the
  -- first actually flips the status (its WHERE clause requires
  -- cr.status = 'running'); the second's UPDATE matches zero rows and is a
  -- harmless no-op — both still correctly report the final 'failed'
  -- status to their callers, and neither processes any owners.
  if v_status = 'running' then
    update public.cron_runs as cr
    set status = 'failed', updated_at = now()
    where cr.job_name = p_job_name
      and cr.period_start = p_period_start
      and cr.status = 'running'
      and cr.lease_expires_at <= now()
      and cr.attempt_count >= p_max_attempts;

    select cr.status into v_status
    from public.cron_runs as cr
    where cr.job_name = p_job_name and cr.period_start = p_period_start;
  end if;

  return query select false, v_attempt, v_status;
end;
$$;

revoke execute on function claim_cron_lease(text, date, int, int) from public, anon, authenticated;
grant execute on function claim_cron_lease(text, date, int, int) to service_role;

-- ============================================================
-- release_cron_lease — called once per invocation when it stops (whether
-- it finished everyone, hit its own time/count budget, or caught a
-- batch-level error). status='running' deliberately leaves the row
-- resumable; only an explicit 'completed' short-circuits future claims.
-- ============================================================
create or replace function release_cron_lease(p_job_name text, p_period_start date, p_status text, p_processed int, p_skipped int, p_failed int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('running', 'completed', 'failed') then
    raise exception 'release_cron_lease: invalid status %', p_status;
  end if;

  update public.cron_runs
  set status = p_status,
      processed_count = processed_count + p_processed,
      skipped_count = skipped_count + p_skipped,
      failed_count = failed_count + p_failed,
      finished_at = case when p_status in ('completed', 'failed') then now() else finished_at end,
      updated_at = now()
  where job_name = p_job_name and period_start = p_period_start;
end;
$$;

revoke execute on function release_cron_lease(text, date, text, int, int, int) from public, anon, authenticated;
grant execute on function release_cron_lease(text, date, text, int, int, int) to service_role;
