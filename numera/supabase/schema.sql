-- ═══════════════════════════════════════════════════════════════════
-- NUMERA — Supabase schema (PostgreSQL)
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- ═══════════════════════════════════════════════════════════════════

-- ── Extensions ─────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Tables ─────────────────────────────────────────────────────────

-- profiles: one row per auth.users user. id matches auth.users.id.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  email         text not null,
  wallet_balance numeric(12,2) not null default 0,
  wallet_hold    numeric(12,2) not null default 0,
  status        text not null default 'active' check (status in ('active','blocked')),
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.transactions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('credit','debit')),
  amount      numeric(12,2) not null,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_transactions_user on public.transactions(user_id);

create table if not exists public.number_requests (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  service         text not null,
  country         text not null,
  number          text not null,
  otp_code        text,
  status          text not null default 'pending' check (status in ('active','pending','released','expired')),
  cost            numeric(12,2) not null default 0,
  hold_amount     numeric(12,2) not null default 0,
  expires_at      timestamptz,
  otp_received_at timestamptz,
  requested_at    timestamptz not null default now(),
  released_at     timestamptz
);
create index if not exists idx_numbers_user on public.number_requests(user_id);
create index if not exists idx_numbers_status on public.number_requests(status);

create table if not exists public.mailboxes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  address    text not null,
  token      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_mailboxes_user on public.mailboxes(user_id);

create table if not exists public.payment_requests (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  amount         numeric(12,2) not null,
  screenshot_url text not null,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_reply    text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);
create index if not exists idx_payments_status on public.payment_requests(status);

create table if not exists public.settings (
  key   text primary key,
  value text
);

create table if not exists public.service_prices (
  service text primary key,
  price   numeric(12,2) not null
);

-- ── Default settings ───────────────────────────────────────────────
insert into public.settings (key, value) values
  ('np_api_key', ''),
  ('np_base_url', 'https://numberpanel.tech'),
  ('price_per_number', '5.00'),
  ('site_name', 'Numera'),
  ('min_topup_amount', '50'),
  ('number_hold_minutes', '20'),
  ('country_status', ''),
  ('contact_email', ''),
  ('site_logo_url', ''),
  ('payment_method_name', 'Bank Transfer'),
  ('payment_bank_name', ''),
  ('payment_account_title', ''),
  ('payment_account_number', ''),
  ('payment_instructions', '')
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════
-- Trigger: auto-create a profile when a new auth user signs up.
-- Username comes from the user_metadata passed at signUp().
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- Wallet RPC functions (SECURITY DEFINER — called from serverless funcs
-- with the service role key; they enforce atomicity the JS client can't).
-- ═══════════════════════════════════════════════════════════════════

-- Reserve `p_amount` from available balance. Returns true on success.
create or replace function public.hold_wallet(p_user_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
    set wallet_hold = wallet_hold + p_amount
    where id = p_user_id and (wallet_balance - wallet_hold) >= p_amount;
  return found;
end;
$$;

-- Release a hold without charging (expired / cancelled number).
create or replace function public.release_hold(p_user_id uuid, p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
    set wallet_hold = greatest(wallet_hold - p_amount, 0)
    where id = p_user_id;
end;
$$;

-- Convert a hold into a real charge and log the transaction.
create or replace function public.finalize_hold(p_user_id uuid, p_amount numeric, p_description text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
    set wallet_balance = wallet_balance - p_amount,
        wallet_hold    = greatest(wallet_hold - p_amount, 0)
    where id = p_user_id and wallet_balance >= p_amount;
  if not found then return false; end if;
  insert into public.transactions (user_id, type, amount, description)
    values (p_user_id, 'debit', p_amount, p_description);
  return true;
end;
$$;

-- Add or deduct credit + log a transaction (admin manual adjustments / top-ups).
create or replace function public.adjust_wallet(p_user_id uuid, p_amount numeric, p_type text, p_description text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if p_type = 'debit' then
    update public.profiles
      set wallet_balance = wallet_balance - p_amount
      where id = p_user_id and wallet_balance >= p_amount;
    if not found then return false; end if;
  else
    update public.profiles set wallet_balance = wallet_balance + p_amount where id = p_user_id;
  end if;
  insert into public.transactions (user_id, type, amount, description)
    values (p_user_id, p_type, p_amount, p_description);
  return true;
end;
$$;

-- Approve a pending payment: credit the wallet, log the transaction, mark approved.
create or replace function public.approve_payment(p_payment_id bigint, p_reply text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_amount numeric;
begin
  select user_id, amount into v_user_id, v_amount
    from public.payment_requests where id = p_payment_id and status = 'pending';
  if v_user_id is null then return false; end if;

  update public.profiles set wallet_balance = wallet_balance + v_amount where id = v_user_id;
  insert into public.transactions (user_id, type, amount, description)
    values (v_user_id, 'credit', v_amount, 'Top-up approved (payment #' || p_payment_id || ')');
  update public.payment_requests
    set status = 'approved', admin_reply = p_reply, reviewed_at = now()
    where id = p_payment_id;
  return true;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- Users can read their OWN rows. All writes happen through the service role
-- (serverless functions), which bypasses RLS. Settings are world-readable so
-- the public landing page + SPA can load site config (the API key is filtered
-- out by the public-settings function and never reaches the client).
-- ═══════════════════════════════════════════════════════════════════
alter table public.profiles          enable row level security;
alter table public.transactions      enable row level security;
alter table public.number_requests   enable row level security;
alter table public.mailboxes         enable row level security;
alter table public.payment_requests  enable row level security;
alter table public.settings          enable row level security;
alter table public.service_prices    enable row level security;

drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for select using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "tx_self" on public.transactions;
create policy "tx_self" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "numbers_self" on public.number_requests;
create policy "numbers_self" on public.number_requests
  for select using (auth.uid() = user_id);

drop policy if exists "mail_self" on public.mailboxes;
create policy "mail_self" on public.mailboxes
  for select using (auth.uid() = user_id);

drop policy if exists "payments_self" on public.payment_requests;
create policy "payments_self" on public.payment_requests
  for select using (auth.uid() = user_id);

-- Allow a user to insert their own payment request + mailbox row.
drop policy if exists "payments_insert_self" on public.payment_requests;
create policy "payments_insert_self" on public.payment_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "mail_insert_self" on public.mailboxes;
create policy "mail_insert_self" on public.mailboxes
  for insert with check (auth.uid() = user_id);

-- Public-readable reference data.
drop policy if exists "settings_read" on public.settings;
create policy "settings_read" on public.settings for select using (true);

drop policy if exists "prices_read" on public.service_prices;
create policy "prices_read" on public.service_prices for select using (true);

-- ═══════════════════════════════════════════════════════════════════
-- Storage bucket for payment screenshots
-- ═══════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
  values ('payments', 'payments', true)
  on conflict (id) do nothing;

drop policy if exists "payments_upload" on storage.objects;
create policy "payments_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'payments');

drop policy if exists "payments_read" on storage.objects;
create policy "payments_read" on storage.objects
  for select using (bucket_id = 'payments');

-- ═══════════════════════════════════════════════════════════════════
-- PROMOTE YOURSELF TO ADMIN
-- After registering your account on the live site, run:
--   update public.profiles set is_admin = true where email = 'you@example.com';
-- Then open /admin in the browser.
-- ═══════════════════════════════════════════════════════════════════
