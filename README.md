# Expense Tracker

Personal income & expense tracker — free to run forever: a static React app on **GitHub Pages** backed by a free-tier **Supabase** project you own. Fully responsive, installable as a mobile app (PWA), light/dark theme.

**Live app:** https://aswinlegarcon.github.io/expense_tracker/

## Features

- **Transactions** — quick-add from anywhere (+ button), income & expenses, **cash vs credit-card** on every expense, categories with emoji + colour, notes, date grouping, day subtotals, month pager, filters (type / payment method / category), search, edit & delete
- **Credit card tracking** — mark spends as Credit, and the card panel shows what you still owe. Record the bill payment ("Card bill" type, with a *Pay full* shortcut) and the outstanding drops to zero with an **"All settled — bill tallies"** badge. Bill payments are **transfers, not spending**: they never appear in totals, charts or budgets, so a card purchase is counted once when you charge it, not again when you pay the bill
- **Investments & emergency fund** — kept completely separate from spending. Investment categories (e.g. *Investment*, *Risky investment*) track how much you've put in; funds (e.g. *Emergency fund*) keep a running balance with deposits and withdrawals. The dashboard adds an **Invested this month** tile and a section with your fund balance, where this month's savings went (invested · to funds · kept in bank), your split across investment categories, and a monthly investment chart. Recurring rules can post SIPs and monthly fund deposits automatically
- **Dashboard** — this-month spent / income / invested / net savings, spending-by-category donut, 6-month income-vs-expense bars, cumulative spending-pace line vs last month, and a **month-over-month category comparison where categories that increased are bolded, tinted red, and sorted first**
- **Budgets** — overall + per-category monthly budgets with progress bars and over-budget callouts
- **Recurring transactions** — weekly / monthly / yearly rules (rent, salary, subscriptions) that post themselves when you open the app; month-end anchors handled (a "31st" rule posts Feb 28, then back to the 31st); missed periods backfill; double-posting is impossible even with two devices open (row-locked RPC)
- **Data tools** — CSV export, full JSON backup, JSON restore
- **Settings** — currency (synced, `en-IN` digit grouping), theme (system / light / dark), category manager with archiving
- **PWA** — installable on Android/iOS/desktop, app-shell cached; data requires being online

## Tech

Vite + React 19 + TypeScript · Tailwind CSS v4 · TanStack Query v5 · Recharts · Supabase (Postgres + Auth, `@supabase/supabase-js`) · vite-plugin-pwa. Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

All data lives in **your** Supabase project, isolated by Postgres Row Level Security; the only credentials in the build are the project URL and the anon (publishable) key, which are designed to be public — RLS is the security boundary.

## One-time setup

### 1. Create the Supabase project

1. Sign up / sign in at [supabase.com](https://supabase.com) (free).
2. **New project** → name it anything (e.g. `expense-tracker`), pick a strong DB password (you won't need it day-to-day), choose a nearby region (e.g. Mumbai) → **Create**.

### 2. Create the database schema

1. In the project sidebar: **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   The script is idempotent — safe to run again after future updates.

### 3. Configure auth (single-user, no public signups)

1. **Authentication → Sign In / Up → Email**: turn **off** "Confirm email".
2. **Authentication → Users → Add user**: your email + a strong password, tick **Auto Confirm User**.
   (Creating the user *after* the schema means the signup trigger seeds your default categories; the app also self-heals if you did it in the other order.)
3. Back in **Sign In / Up**: turn **off** "Allow new users to sign up" — nobody else can register against your project.

### 4. Wire the app to your project

1. **Project Settings → API** (or "Data API"): copy the **Project URL** and the **anon / publishable key**.
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - `VITE_SUPABASE_URL` = the project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon/publishable key
3. Re-run the deploy: **Actions → deploy → Run workflow** (or just push any commit).
4. Open https://aswinlegarcon.github.io/expense_tracker/ and sign in. Done.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the same two values
npm run dev                  # http://localhost:5173/expense_tracker/
```

`npm run build` type-checks and produces `dist/`.

You can also run a fully local backend with Docker via the Supabase CLI: `npx supabase start`, then point `.env.local` at the printed local URL/key and apply `supabase/schema.sql` once.

## Operational notes

- **Free-tier pause:** Supabase pauses free projects after ~1 week with no API traffic. The `keepalive` workflow pings it twice a week to prevent that. If it ever pauses anyway, restore it with one click in the Supabase dashboard — no data is lost. (GitHub itself disables cron workflows after ~60 days without repo activity; any commit re-enables them.)
- **Backups:** Settings → "Download backup" exports everything as JSON; "Import backup" restores it into a fresh account (additive; no de-duplication). Backups from older versions still import.

## Moving existing categories to investments or funds

If you were already logging investments or emergency-fund money as expenses:

1. Settings → **Download backup** (a safety copy).
2. Re-run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor, then reload the app. The upgrade only adds things — it changes none of your rows.
3. Settings → Categories → tap the category → **Counts as** → *Investment* or *Fund* → **Move**. The confirmation shows exactly how many entries (and how much) will move.

A move re-labels the category and its entries in one atomic step. Amounts, dates, notes and payment methods never change, nothing is deleted, and choosing **Counts as → Expense** later moves it back exactly. Earlier months' Spent and Net savings update accordingly, because the history is now classified correctly. For a fund, open it and enter its **current balance**: anything held before you started tracking is stored once, so entries already recorded there are never counted twice. A fund with withdrawals can't be moved back to Expense (a withdrawal only makes sense for a fund).
- **Never** put the `service_role` key anywhere near this repo or the app — the anon key is the only one the client should ever see.

## Data model

`profiles` (currency) · `categories` (emoji, colour, archived) · `transactions` (type, amount, category, payment method, date, note) · `budgets` (per-category or overall monthly amount) · `recurring_rules` (frequency, anchor date, next occurrence). Every table is RLS-protected to the signed-in user; recurring posting runs in a single atomic RPC (`post_due_recurring`).

A transaction's `type` is `expense`, `income`, `card_payment`, `investment`, `fund_deposit` or `fund_withdrawal`. Only `expense` is spending — every other outflow is a transfer, excluded from spending totals, charts and budgets. Categories have a matching `kind`: `expense`, `income`, `investment` or `fund` (investment and fund categories also carry an `opening_balance`). `payment_method` is `cash` (money left immediately — cash, UPI, debit) or `credit` (charged to the card), and only expenses, investments and fund deposits can be `credit`. Card outstanding = everything charged to the card minus every `card_payment`, computed over all history by the `credit_summary` RPC so the balance carries across months and always tallies. Holding balances come from `holdings_summary` (opening balance + money in − money out, all history), and `move_category` re-files a category and its entries atomically. `schema_version()` tells the app which upgrades the database has.

**Re-running the schema:** `supabase/schema.sql` stays a single idempotent file. Columns and constraints added after the first release are repeated as guarded `alter` statements below the table definitions, so pasting the whole file again upgrades an existing project without touching your data. Each constraint there is defined exactly once and only ever widened — never append a second copy for a new release, or a later run re-adds the old, narrower one and aborts.
