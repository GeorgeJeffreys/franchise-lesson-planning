-- 0032_user_deactivation.sql
--
-- Global user administration, part 1 of 4: the deactivation store + a shared
-- "am I deactivated" predicate. See 0033 (enforcement), 0034 (list_users_admin),
-- 0035 (set_user_admin / set_user_deactivated).
--
-- MODEL. An admin is `profiles.role = 'admin'` (org-wide), gated by `is_admin()`.
-- `profiles` is a LOCKED table, so a user's deactivation status cannot live on it
-- — it lives here, in a separate side table. Deactivation must RETAIN a user's
-- `subject_membership` rows (reactivation restores access losslessly, and the
-- Users tab shows the retained spaces), so it is modelled as a "not deactivated"
-- PREDICATE layered onto the access helpers rather than by deleting memberships.
--
-- This migration adds ONLY the table + the `is_deactivated()` helper. 0033 wires
-- the predicate into `is_admin()` / `is_member_of_subject()` /
-- `is_coordinator_of_subject()` (and two known bypasses).
--
-- Follows the established definer convention: security definer, STABLE, pinned
-- `set search_path = public`, `revoke execute from public` + `grant execute to
-- authenticated` (mirrors admin_list_users / complete_onboarding).
--
-- CC never applies migrations — George runs this in the Supabase SQL editor.
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE): safe to re-run.

-- ── user_deactivation ─────────────────────────────────────────────────────────
-- One row per CURRENTLY-deactivated user. Reactivation DELETES the row, so a row
-- existing == the user is deactivated. `deactivated_by` records the acting admin
-- (nullable so a system/script action does not break the write). ON DELETE
-- CASCADE from profiles keeps the table clean if a profile is ever removed.
create table if not exists public.user_deactivation (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  deactivated_at timestamptz not null default now(),
  deactivated_by uuid references public.profiles(id)
);

alter table public.user_deactivation enable row level security;

-- Admin-select only. There is NO client write policy: the table is written
-- exclusively by the SECURITY DEFINER RPC `set_user_deactivated` (0035), which is
-- itself admin-gated. A non-admin (including a deactivated user) can read nothing
-- here — deactivation status is surfaced to the app through `is_deactivated()`
-- (definer, below), never by selecting this table directly.
drop policy if exists user_deactivation_admin_select on public.user_deactivation;
create policy user_deactivation_admin_select
  on public.user_deactivation for select to authenticated
  using (public.is_admin());

-- ── is_deactivated() ──────────────────────────────────────────────────────────
-- True when the CALLER (auth.uid()) has an active deactivation row. SECURITY
-- DEFINER so it reads `user_deactivation` regardless of the caller's own row
-- visibility (the admin-select policy above would otherwise hide a non-admin's
-- own row). This is the single source of truth for the deactivation predicate —
-- 0033 references it from the three access helpers, from `shares_subject_space`,
-- and inline from the resource-bank coordinator policies, so "deactivated" means
-- exactly the same thing everywhere.
--
-- No recursion: is_admin() (used by the policy above) will call is_deactivated()
-- once 0033 lands, but is_deactivated() reads user_deactivation as a DEFINER, so
-- no policy is evaluated and the two never recurse into each other.
create or replace function public.is_deactivated()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_deactivation
    where user_id = auth.uid()
  );
$$;

revoke execute on function public.is_deactivated() from public;
grant  execute on function public.is_deactivated() to authenticated;
