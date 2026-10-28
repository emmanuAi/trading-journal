-- Rollback for db/ai-coach-migration-phase6.sql
-- Safe for existing trade/account/chat/report data in all directions —
-- nothing here ever references accounts/trades/coach_*/ai_budget_ledger.
-- Dropping the `source` column loses the manual-vs-scheduled distinction on
-- existing reports (they revert to undifferentiated), but deletes no rows.
-- Not run as part of Phase 6 — kept here only in case it's ever needed.

drop function if exists release_cron_lease(text, date, text, int, int, int);
drop function if exists claim_cron_lease(text, date, int, int);
drop table if exists cron_runs;
alter table ai_weekly_reports drop column if exists source;
alter table settings drop column if exists auto_weekly_reports_enabled;
