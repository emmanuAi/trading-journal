-- AI Trading Coach — Phase 6 hotfix
-- Targeted fix for two issues found during live post-migration verification
-- of db/ai-coach-migration-phase6.sql (already applied to production).
-- Contains ONLY the corrected claim_cron_lease definition and the missing
-- DELETE grant — nothing else from the original migration is repeated or
-- re-run here. Safe to run once, any number of times (CREATE OR REPLACE
-- and GRANT are both idempotent).
--
-- Bug 1: claim_cron_lease threw "column reference 'status' is ambiguous"
-- on every real call. `returns table (claimed boolean, attempt_count int,
-- status text)` implicitly declares `attempt_count` and `status` as
-- PL/pgSQL variables in the function's own scope — and cron_runs ALSO has
-- columns with those exact names, so every bare reference inside a query
-- against cron_runs collided with the function's own output parameters.
-- Confirmed live: the entire lease-claim mechanism did not work at all as
-- originally deployed. Fixed by aliasing cron_runs as `cr` and qualifying
-- every single column reference to it throughout the function body — never
-- relying on an unqualified name to resolve to the table rather than an
-- OUT parameter.
--
-- Bug 2: the original migration granted only select/insert/update on
-- cron_runs to service_role, omitting delete. Not a security issue
-- (service_role already bypasses RLS everywhere — the real boundary is
-- excluding authenticated/anon, which is unaffected here), but it meant
-- not even a service-role script could clean up a stray row. This grant
-- is additive to the existing select/insert/update grant, not a
-- replacement of it.
--
-- Security configuration preserved unchanged from the original migration,
-- reviewed again here:
--   - Function signature: identical — claim_cron_lease(text, date, int,
--     int) returning table(claimed boolean, attempt_count int, status
--     text). No caller (the route or its tests) needs any change.
--   - security definer: unchanged.
--   - set search_path = public: unchanged, and every table reference
--     inside the body is now ALSO fully schema-qualified
--     (public.cron_runs) in addition to the pinned search_path — the two
--     protections are independent and both still apply.
--   - EXECUTE permissions: unchanged — revoked from public/anon/
--     authenticated, granted only to service_role.

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

  -- Reclaim: one atomic, fully self-contained conditional UPDATE. Only a
  -- row that is still 'running', whose lease has actually expired, and
  -- whose attempt_count is still under the ceiling AT THE MOMENT THIS
  -- UPDATE RUNS can match — this is what makes two concurrent reclaim
  -- attempts safe (the second's WHERE clause re-evaluates against the
  -- already-updated row and matches zero rows).
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

-- Bug 2 fix — additive grant, does not touch the existing select/insert/
-- update grant already in place on cron_runs.
grant delete on cron_runs to service_role;
