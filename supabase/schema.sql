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

-- 2) categories. kind 'investment' and 'fund' are holdings (money you keep, not spend):
--    each investment category is a bucket you invest into, each fund is a balance.
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 40),
  kind            text not null check (kind in ('expense','income','investment','fund')),
  icon            text not null default '🏷️',
  color           text not null default '#64748b' check (color ~* '^#[0-9a-f]{6}$'),
  is_archived     boolean not null default false,
  sort_order      int not null default 0,
  opening_balance numeric(12,2) not null default 0,  -- holdings only: amount held before tracking began
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- 3) recurring rules (transactions references these, so create first)
create table if not exists public.recurring_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type            text not null check (type in ('expense','income','investment','fund_deposit')),
  amount          numeric(12,2) not null check (amount > 0),
  category_id     uuid references public.categories(id) on delete set null,
  payment_method  text not null default 'cash',
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
  type              text not null check (type in ('expense','income','card_payment',
                                                  'investment','fund_deposit','fund_withdrawal')),
  amount            numeric(12,2) not null check (amount > 0),
  category_id       uuid references public.categories(id) on delete set null,
  payment_method    text not null default 'cash',
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

-- ============================================================================
-- Upgrades for databases created before a feature was added. The create-table
-- statements above only run on a fresh project, so every later column or
-- constraint change is repeated here as a guarded alter.
--
-- RULE: each constraint below is defined exactly ONCE, at its latest definition,
-- and is only ever widened. Never append a second copy for a new release: the
-- older, narrower copy would be re-added on every later run and fail against
-- rows that use the new values, aborting the whole script.
-- ============================================================================

-- Cash vs credit-card spending.
alter table public.transactions    add column if not exists payment_method text not null default 'cash';
alter table public.recurring_rules add column if not exists payment_method text not null default 'cash';

alter table public.transactions    drop constraint if exists transactions_payment_method_check;
alter table public.transactions    add  constraint transactions_payment_method_check
  check (payment_method in ('cash','credit'));
alter table public.recurring_rules drop constraint if exists recurring_rules_payment_method_check;
alter table public.recurring_rules add  constraint recurring_rules_payment_method_check
  check (payment_method in ('cash','credit'));

-- Transaction types. Only 'expense' is spending. 'card_payment' settles the card,
-- 'investment' and 'fund_deposit' move money into holdings, 'fund_withdrawal'
-- moves it back out — all transfers, never counted as spending.
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add  constraint transactions_type_check
  check (type in ('expense','income','card_payment','investment','fund_deposit','fund_withdrawal'));
alter table public.recurring_rules drop constraint if exists recurring_rules_type_check;
alter table public.recurring_rules add  constraint recurring_rules_type_check
  check (type in ('expense','income','investment','fund_deposit'));
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add  constraint categories_kind_check
  check (kind in ('expense','income','investment','fund'));

-- Only outflows that can be charged to the card may be 'credit' — the same list as
-- credit_summary() and canUseCredit() in the app. This supersedes the earlier
-- transactions_card_payment_check; keep its drop forever so older projects lose it.
-- NOT VALID: enforced on every new write, never re-checked against old rows.
alter table public.transactions drop constraint if exists transactions_card_payment_check;
alter table public.transactions drop constraint if exists transactions_credit_outflow_check;
alter table public.transactions add  constraint transactions_credit_outflow_check
  check (payment_method = 'cash' or type in ('expense','investment','fund_deposit')) not valid;
alter table public.recurring_rules drop constraint if exists recurring_rules_credit_outflow_check;
alter table public.recurring_rules add  constraint recurring_rules_credit_outflow_check
  check (payment_method = 'cash' or type in ('expense','investment','fund_deposit')) not valid;

-- Amount already held in an investment or fund before you started tracking it.
-- A constant default is stored in the catalog: no table rewrite, existing rows read 0.
alter table public.categories add column if not exists opening_balance numeric(12,2) not null default 0;
alter table public.categories drop constraint if exists categories_opening_balance_check;
alter table public.categories add  constraint categories_opening_balance_check
  check (opening_balance >= 0);

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
    (new.id,'income','Investment returns','📈','#a855f7',3),
    (new.id,'income','Gifts','🎁','#f59e0b',4),
    (new.id,'income','Other Income','💰','#64748b',5),
    (new.id,'investment','Investments','📊','#7c3aed',1),
    (new.id,'fund','Emergency fund','🛟','#0d9488',1)
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
      -- only card-chargeable types keep 'credit'; one bad rule must never block every posting
      insert into public.transactions (user_id, type, amount, category_id, payment_method, occurred_on, note, recurring_rule_id)
      values (r.user_id, r.type, r.amount, r.category_id,
              case when r.type in ('expense','investment','fund_deposit') then r.payment_method else 'cash' end,
              r.next_occurrence, r.note, r.id);
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

-- ============ credit card: outstanding balance and settlement state =========
-- Outstanding = everything ever charged to the card minus every bill payment.
-- Computed over all history (not a date window) so the balance always tallies.
-- "Charged" covers every card-chargeable type, so moving a card-paid entry from
-- expense to investment never changes what you owe.
create or replace function public.credit_summary()
returns table (
  outstanding      numeric,
  lifetime_charged numeric,
  lifetime_paid    numeric,
  last_paid_on     date,
  last_paid_amount numeric
)
language sql security invoker stable set search_path = public as $$
  with totals as (
    select
      coalesce(sum(amount) filter (where payment_method = 'credit'
                                     and type in ('expense','investment','fund_deposit')), 0) as charged,
      coalesce(sum(amount) filter (where type = 'card_payment'), 0)                           as paid
    from public.transactions
    where user_id = auth.uid()
  ),
  last_payment as (
    select occurred_on, amount
    from public.transactions
    where user_id = auth.uid() and type = 'card_payment'
    order by occurred_on desc, created_at desc
    limit 1
  )
  select t.charged - t.paid, t.charged, t.paid, lp.occurred_on, lp.amount
  from totals t left join last_payment lp on true;
$$;

-- ============ holdings: move a category between expense / investment / fund ====
-- Re-labels a category and its entries in one atomic step. Only the category's
-- kind and its entries' type change — amounts, dates, notes, payment methods and
-- ids are untouched, nothing is deleted, and moving it back reverses it exactly.
-- Returns the number of entries re-labelled.
create or replace function public.move_category(p_category_id uuid, p_kind text)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  c      public.categories%rowtype;
  v_type text;
  v_n    integer;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_kind is null or p_kind not in ('expense','investment','fund') then
    raise exception 'A category can only be moved to expense, investment or fund';
  end if;

  -- Lock the category's rules before the category itself: post_due_recurring
  -- locks a rule and then the category (through the foreign key), so taking
  -- them in the same order means the two can never deadlock.
  perform 1 from public.recurring_rules
   where user_id = v_uid and category_id = p_category_id order by id for update;
  -- FOR UPDATE also holds back new entries in this category until the move commits.
  select * into c from public.categories
   where id = p_category_id and user_id = v_uid for update;
  if not found then raise exception 'Category not found'; end if;
  if c.kind not in ('expense','investment','fund') then
    raise exception 'Income categories cannot be moved';
  end if;

  v_type := case p_kind when 'expense' then 'expense' when 'investment' then 'investment' else 'fund_deposit' end;

  -- A withdrawal only makes sense against a fund.
  if p_kind <> 'fund' then
    select count(*) into v_n from public.transactions
     where user_id = v_uid and category_id = p_category_id and type = 'fund_withdrawal';
    if v_n > 0 then
      raise exception '"%" has % withdrawal(s). Delete them or change their type before moving it.', c.name, v_n;
    end if;
  end if;

  -- Category first. The handler re-raises, so a clash rolls back the whole call.
  if c.kind <> p_kind then
    begin
      update public.categories set kind = p_kind where id = c.id;
    exception when unique_violation then
      raise exception 'Another category named "%" already exists there. Rename one of them first.', c.name;
    end;
  end if;

  -- Re-type money-out entries only. Income, card payments and withdrawals are never
  -- touched. Matching every outflow type (not just the old one) also repairs strays,
  -- and makes a repeated call a harmless no-op.
  update public.recurring_rules set type = v_type
   where user_id = v_uid and category_id = p_category_id
     and type in ('expense','investment','fund_deposit') and type <> v_type;
  update public.transactions set type = v_type
   where user_id = v_uid and category_id = p_category_id
     and type in ('expense','investment','fund_deposit') and type <> v_type;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ============ holdings: totals per investment / fund over all history =========
-- balance = opening balance + money put in − money taken out. For investments this
-- is the amount invested (cost), not market value. Archived holdings are included
-- so archiving never makes money disappear from the totals.
drop function if exists public.holdings_summary();
create function public.holdings_summary()
returns table (
  category_id     uuid,
  kind            text,
  name            text,
  icon            text,
  color           text,
  is_archived     boolean,
  opening_balance numeric,
  deposited       numeric,
  withdrawn       numeric,
  balance         numeric,
  last_activity   date
)
language sql security invoker stable set search_path = public as $$
  select c.id, c.kind, c.name, c.icon, c.color, c.is_archived, c.opening_balance,
         coalesce(t.deposited, 0),
         coalesce(t.withdrawn, 0),
         c.opening_balance + coalesce(t.deposited, 0) - coalesce(t.withdrawn, 0),
         t.last_on
  from public.categories c
  -- aggregate before joining, so the opening balance is never repeated per entry
  left join (
    select x.category_id,
           sum(x.amount) filter (where x.type in ('investment','fund_deposit')) as deposited,
           sum(x.amount) filter (where x.type = 'fund_withdrawal')              as withdrawn,
           max(x.occurred_on)                                                   as last_on
    from public.transactions x
    where x.user_id = auth.uid() and x.category_id is not null
      and x.type in ('investment','fund_deposit','fund_withdrawal')
    group by x.category_id
  ) t on t.category_id = c.id
  where c.user_id = auth.uid() and c.kind in ('investment','fund')
  order by c.kind, c.is_archived, c.sort_order, c.name;
$$;

-- ============ version marker: keep LAST ======================================
-- The app compares this with the version it needs and asks you to re-run this
-- file when the database is behind.
--   1 = initial release   2 = cash vs credit   3 = investments and funds
create or replace function public.schema_version()
returns integer language sql stable set search_path = '' as $$ select 3 $$;

-- refresh the API's view of the schema so new functions work immediately
notify pgrst, 'reload schema';
