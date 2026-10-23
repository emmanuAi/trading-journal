-- Rollback for db/ai-coach-migration.sql
-- Safe for existing trade/account data in both directions (nothing here
-- ever references accounts/trades/etc.). NOT safe once real chat/report/
-- usage data exists in the 5 tables below — this permanently deletes it.
-- Not run as part of Phase 2 — kept here only in case it's ever needed.

drop function if exists get_ai_budget_status();
drop function if exists reconcile_ai_spend_for_owner(uuid, uuid, numeric, numeric);
drop function if exists reserve_ai_spend_for_owner(uuid, text, numeric, numeric);
drop function if exists reconcile_ai_spend(uuid, numeric, numeric);
drop function if exists reserve_ai_spend(text, numeric, numeric);
drop table if exists coach_messages;
drop table if exists coach_conversations;
drop table if exists ai_weekly_reports;
drop table if exists ai_usage_log;
drop table if exists ai_budget_ledger;
