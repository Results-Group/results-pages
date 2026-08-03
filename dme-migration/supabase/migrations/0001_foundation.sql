-- ============================================================================
-- DME migration — 0001_foundation
-- Extensions, the app-users table wired to Supabase Auth, updated_at trigger,
-- and the shared authorization helpers every table's RLS policy uses.
--
-- Run order: this file FIRST, then 0002_tables.sql, then 0003_rls.sql.
-- Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fast ILIKE search on slugs/emails

-- ---------------------------------------------------------------------------
-- app_users: the profile/role row for each authenticated user.
-- Supabase Auth owns auth.users (email, password, sessions). This mirrors the
-- Base44 `User` entity's custom fields (role, phone, staff flags) and is keyed
-- by the auth user id. A row is created automatically on signup (trigger below).
--
-- `role` is the platform-wide admin flag Base44 expressed as
-- {"user_condition":{"role":"admin"}}. It is deliberately NOT self-writable —
-- see the app_users_update_self policy below.
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
    id                uuid primary key references auth.users(id) on delete cascade,
    email             text,
    full_name         text,
    role              text not null default 'user' check (role in ('admin','user')),
    phone             text,
    shipping_address  jsonb,
    is_staff_member   boolean not null default false,
    staff_permissions jsonb   not null default '[]'::jsonb,
    -- Base44 ids are opaque strings (e.g. '6a5f522ccd76db76a44420fc'). Keeping the
    -- original here lets the data import re-point every foreign key without
    -- guessing, and gives us a rollback trail back to the source system.
    base44_id         text unique,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists app_users_email_idx on public.app_users (lower(email));

-- Keep the profile in sync with the auth record at signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.app_users (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helpers used by every RLS policy.
-- is_admin() replaces Base44's {"user_condition":{"role":"admin"}}.
-- SECURITY DEFINER + a fixed search_path so a policy can call it without the
-- caller needing select on app_users (which would recurse through RLS).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
    select exists (
        select 1 from public.app_users
        where id = auth.uid() and role = 'admin'
    );
$$;

-- Owns a card? Used by the card-scoped tables (analytics, leads, team members)
-- so ownership is expressed once instead of being re-derived per policy.
create or replace function public.owns_card(card uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
    select exists (
        select 1 from public.digital_cards c
        where c.id = card and c.user_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- Generic updated_at maintenance. Base44 stamped updated_date on every write;
-- this reproduces it so existing "sort by -updated_date" behaviour still works.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_app_users_updated on public.app_users;
create trigger trg_app_users_updated
    before update on public.app_users
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- app_users RLS: a user sees/edits only their own row; admins see all.
-- ---------------------------------------------------------------------------
alter table public.app_users enable row level security;

drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users
    for select using (id = auth.uid() or public.is_admin());

-- A user may edit their own profile but MUST NOT be able to promote themselves.
-- Base44 had no server-side guard here; on Postgres the check is enforced by
-- comparing against the current row via a trigger (policies can't see OLD).
drop policy if exists app_users_update_self on public.app_users;
create policy app_users_update_self on public.app_users
    for update using (id = auth.uid() or public.is_admin())
    with check (id = auth.uid() or public.is_admin());

create or replace function public.guard_privileged_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    if public.is_admin() then
        return new;
    end if;
    -- Non-admins keep their existing privilege columns no matter what they send.
    new.role              := old.role;
    new.is_staff_member   := old.is_staff_member;
    new.staff_permissions := old.staff_permissions;
    return new;
end;
$$;

drop trigger if exists trg_app_users_guard on public.app_users;
create trigger trg_app_users_guard
    before update on public.app_users
    for each row execute function public.guard_privileged_columns();

drop policy if exists app_users_admin_all on public.app_users;
create policy app_users_admin_all on public.app_users
    for all using (public.is_admin()) with check (public.is_admin());
