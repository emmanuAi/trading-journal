# Trading Journal

A premium, dark-mode trading journal and performance analytics app for a Forex swing trader — fast trade entry, chart screenshots, a trading-psychology journal, and a full analytics suite that recalculates live from your trades.

Built with Next.js (App Router) + TypeScript + Tailwind CSS v4 + Recharts, backed by Supabase (Postgres + Storage + Auth) — every table is row-level-security-scoped to a single owner, screenshots live in a private Storage bucket served via short-lived signed URLs, and auth is a plain login form (no public signup) against a Supabase Auth user you create yourself.

## Features

- **Dashboard** — KPI cards (win rate, profit factor, avg R, drawdown, streaks, plan compliance, …), a realized equity curve (currency or cumulative-R, with time filters), recent trades, most profitable pairs.
- **Add New Trade** — searchable instrument picker (majors/minors, metals, oil, indices, custom), auto-calculated planned RR / risk amount / realized P&L / actual R with manual overrides, a pre/during/post-trade psychology journal, emotion tags, a pre-save checklist.
- **Trade Journal** — searchable, filterable, sortable trade table; click through to a full detail view with edit, duplicate, and delete.
- **Screenshots** — drag-and-drop uploads per trade phase (before/during/after), stored in a private Supabase Storage bucket and linked to the trade; fullscreen viewer and delete.
- **Analytics** — win rate by pair/strategy/month/day-of-week/direction, expectancy, profit factor, R-multiple distribution, drawdown chart, calendar heatmap, performance by emotion and by plan compliance.
- **Trading Calendar** — monthly view colored by realized daily P&L, click a day to see its trades.
- **Trading Psychology** — weekly/monthly reviews and a searchable mistake library.
- **Settings** — multiple accounts (personal or prop firm, each with its own dashboard, or an aggregated view), starting balance, base currency, risk defaults, custom strategies/tags, demo-data toggle, full JSON backup + CSV export/import.
- **CSV import/export** with duplicate detection, and a full-journal JSON backup.
- Single-owner Supabase Auth (login only, no public signup); every row is RLS-scoped to your Supabase user id.

## Getting started

1. Create a [Supabase](https://supabase.com) project, then run `db/supabase-schema.sql` in its SQL editor (Project → SQL Editor → New query). It's additive-only DDL — safe to run once on a fresh project.
2. Create the one owner account under **Authentication → Users → Add user** (email + password). There's no public signup route by design — this is a single-owner app.
3. Copy `.env.local.example`-style setup: create `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your project's anon/publishable key>
   # SUPABASE_SERVICE_ROLE_KEY= only needed locally if you ever run scripts/migrate-to-supabase.ts
   ```
   Both values are in Supabase under Project Settings → API. The anon key is meant to be public (protected by RLS); never commit the service-role key or put it in Vercel.
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) and sign in with the owner account from step 2. On first login the app seeds a default account and a set of demo trades (clearly flagged, toggle off any time in Settings) so the dashboard isn't empty before you log a real trade.

### Running tests

```bash
npm test
```

Covers the calculation engine (`src/lib/calculations.ts`) — win rate, planned RR, actual R, profit factor, drawdown, equity curve, streaks, plan compliance, return % — including edge cases like zero-denominator division and breakeven handling.

## Architecture

- `src/lib/supabase/server.ts` — request-scoped Supabase client (built fresh per request from the incoming session cookies via `@supabase/ssr`) plus `requireUser()`. This is what every repository function and route uses to authenticate and talk to Postgres/Storage.
- `src/lib/supabase/admin.ts` — service-role client. Bypasses RLS; imported **only** by `scripts/migrate-to-supabase.ts`, never by the app itself.
- `src/lib/repository/*` — all data access (trades, accounts, settings, screenshots, reviews, mistakes), against `@supabase/supabase-js`. Every query is owner-scoped both explicitly (`.eq("owner", user.id)`) and by RLS as the real enforcement boundary.
- `src/lib/calculations.ts` — every derived metric, as pure functions with unit tests. No calculation lives in a component.
- `src/app/api/*` — REST-ish route handlers the UI talks to; `src/proxy.ts` is the single auth gate in front of all of them (and all pages except `/login`).
- `src/app/(app)/*` — the authenticated app (sidebar layout); `src/app/login` is public, login-only (no signup UI).
- Screenshots live in a private Supabase Storage bucket (`trade-screenshots`, path `${ownerId}/${tradeId}/${filename}`) and are served through `/api/screenshots/file/...`, which looks the path up via RLS (so a 404 covers both "doesn't exist" and "isn't yours") and redirects to a 60-second signed URL — never a public bucket URL.

## Supabase setup reference

`db/supabase-schema.sql` is the full schema: every table, RLS policies (`owner = auth.uid()`), the `trade-screenshots` bucket + its storage policies, an atomic `next_trade_id()` sequence/function for human-readable trade ids, and the `GRANT`s needed for `authenticated`/`service_role` to reach those RLS policies in the first place (some Supabase projects don't default-grant these on new tables — if you see `42501 permission denied` from PostgREST on a fresh project, that's why). Safe to re-run; it's additive DDL only.

`scripts/migrate-to-supabase.ts` is a one-off tool for importing an existing local SQLite + on-disk-screenshots dataset (the pre-Supabase version of this app) into a Supabase project. Not part of the running app — `better-sqlite3` is a devDependency only for this script. See the comment header in that file for usage; it backs up the source data first (using SQLite's online backup API, not a plain file copy, since this app ran SQLite in WAL mode), then writes to Postgres/Storage via the service-role key, then verifies row counts/P&L/screenshot sizes before declaring success.

## Notes on calculations

- **Win rate** excludes breakeven trades from the denominator; breakeven count is shown separately.
- **Profit Factor** is `Infinity` (shown as `∞`) when there are wins and zero losses, and `null` (shown as `—`) when there's no realized activity at all — never a misleading number.
- **Actual R** = net trade P&L ÷ initial monetary risk; `null` when risk is unknown or zero.
- **Realized equity curve** only moves on closed trades — open positions are tracked separately and never mixed into realized performance, per the brief.
- Every account's equity curve is independent; the "aggregated" view is opt-in and sums starting balances rather than quietly merging curves.

## Deploying

- **GitHub**: push to a private repo. `.gitignore` already excludes `.env*`, `/data/`, `/storage/`, `/backups/`, `.next/`, and `.vercel` — nothing locally-sensitive should ever be committed.
- **Vercel**: set exactly `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the project's environment variables (Production + Preview + Development). **Never set `SUPABASE_SERVICE_ROLE_KEY` in Vercel** — it has no use in the deployed app and only belongs in a local `.env.local` when running the migration script by hand.

## What's intentionally out of scope for this pass

- A full backup *restore* flow (export is implemented; CSV import covers trades, JSON backup covers everything for safekeeping).
- Light theme (this app is dark-only by design, matching the brief).
