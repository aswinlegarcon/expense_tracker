-- ============================================================================
-- Expense Tracker schema — idempotent, safe to re-run.
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- ============================================================================

-- 1) profiles: one row per auth user; holds settings that sync across devices
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  currency   text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) categories
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  kind        text not null check (kind in ('expense','income')),
  icon        text not null default '🏷️',
  color       text not null default '#64748b' check (color ~* '^#[0-9a-f]{6}$'),
  is_archived boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- 3) recurring rules (transactions references these, so create first)
create table if not exists public.recurring_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type            text not null check (type in ('expense','income')),
  amount          numeric(12,2) not null check (amount > 0),
  category_id     uuid references public.categories(id) on delete set null,
  note            text not null default '',
  frequency       text not null check (frequency in ('weekly','monthly','yearly')),
  start_date      date not null,          -- carries the anchor day-of-month (e.g. 31)
  next_occurrence date not null,
  end_date        date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 4) transactions
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type              text not null check (type in ('expense','income')),
  amount            numeric(12,2) not null check (amount > 0),
  category_id       uuid references public.categories(id) on delete set null,
  occurred_on       date not null,        -- DATE (not timestamptz): no timezone off-by-one
  note              text not null default '',
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 5) budgets: standing monthly amounts; category_id NULL = overall monthly budget
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique nulls not distinct (user_id, category_id)
);

-- Indexes for the hot paths (per-user month-range scans)
create index if not exists transactions_user_date_idx     on public.transactions (user_id, occurred_on desc);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category_id);
create index if not exists categories_user_idx            on public.categories (user_id);
create index if not exists recurring_due_idx              on public.recurring_rules (user_id, next_occurrence) where is_active;

-- ============ Row Level Security: enable on EVERY table, owner-only ========
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.transactions    enable row level security;
alter table public.budgets         enable row level security;
alter table public.recurring_rules enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own recurring" on public.recurring_rules;
create policy "own recurring" on public.recurring_rules
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ============ updated_at maintenance ========================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text;
begin
  foreach t in array array['profiles','categories','transactions','budgets','recurring_rules'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============ signup trigger: auto-create profile + seed default categories =
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.categories (user_id, kind, name, icon, color, sort_order) values
    (new.id,'expense','Food & Dining','🍽️','#f97316',1),
    (new.id,'expense','Groceries','🛒','#84cc16',2),
    (new.id,'expense','Transport','🚗','#06b6d4',3),
    (new.id,'expense','Rent & Home','🏠','#8b5cf6',4),
    (new.id,'expense','Utilities & Bills','💡','#eab308',5),
    (new.id,'expense','Shopping','🛍️','#ec4899',6),
    (new.id,'expense','Entertainment','🎬','#f43f5e',7),
    (new.id,'expense','Health','💊','#10b981',8),
    (new.id,'expense','Education','📚','#3b82f6',9),
    (new.id,'expense','Travel','✈️','#14b8a6',10),
    (new.id,'expense','Subscriptions','📺','#6366f1',11),
    (new.id,'expense','Other','📦','#64748b',12),
    (new.id,'income','Salary','💼','#22c55e',1),
    (new.id,'income','Freelance','💻','#0ea5e9',2),
    (new.id,'income','Investments','📈','#a855f7',3),
    (new.id,'income','Gifts','🎁','#f59e0b',4),
    (new.id,'income','Other Income','💰','#64748b',5)
  on conflict do nothing;
  return new;
exception when others then
  -- never block signup; the app re-seeds idempotently on first load
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ recurring: anchored date advance + atomic due-posting RPC =====
create or replace function public.advance_occurrence(d date, freq text, anchor int)
returns date language sql immutable as $$
  select case freq
    when 'weekly' then d + 7
    when 'yearly' then (d + interval '1 year')::date
    -- monthly, anchor-preserving: a rule anchored on the 31st posts
    -- Jan 31 -> Feb 28 -> Mar 31 instead of decaying to the 28th forever
    else (date_trunc('month', d) + interval '1 month')::date
         + least(anchor, extract(day from (date_trunc('month', d) + interval '2 month' - interval '1 day'))::int) - 1
  end
$$;

create or replace function public.post_due_recurring(p_today date default current_date)
returns integer language plpgsql security invoker set search_path = public as $$
declare r record; posted int := 0; guard int;
begin
  -- clamp obviously-wrong client clocks to server date (+/- 1 day covers IST vs UTC)
  if p_today > current_date + 1 or p_today < current_date - 1 then p_today := current_date; end if;

  for r in
    select * from public.recurring_rules
    where user_id = auth.uid() and is_active and next_occurrence <= p_today
    for update skip locked                -- a concurrent device loses the race and skips
  loop
    guard := 0;
    while r.next_occurrence <= p_today
          and (r.end_date is null or r.next_occurrence <= r.end_date)
          and guard < 120 loop            -- cap missed-period backfill
      insert into public.transactions (user_id, type, amount, category_id, occurred_on, note, recurring_rule_id)
      values (r.user_id, r.type, r.amount, r.category_id, r.next_occurrence, r.note, r.id);
      r.next_occurrence := public.advance_occurrence(r.next_occurrence, r.frequency,
                                                     extract(day from r.start_date)::int);
      posted := posted + 1; guard := guard + 1;
    end loop;
    update public.recurring_rules
       set next_occurrence = r.next_occurrence,
           is_active = (r.end_date is null or r.next_occurrence <= r.end_date)
     where id = r.id;
  end loop;
  return posted;
end $$;
