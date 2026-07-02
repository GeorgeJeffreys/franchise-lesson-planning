-- 0030_impersonation_personas.sql
--
-- Multi-persona test-user impersonation: the DB half.
--
-- Two independent booleans on `profiles`, both `not null default false`:
--   • can_impersonate  — this profile MAY USE the test bar (step into a persona).
--   • is_test_persona  — this profile MAY BE impersonated (appears in the picker).
-- Adding a tester or a persona later is then a single one-row UPDATE / seeded row,
-- with no redeploy — the same philosophy as the existing role/membership model.
--
-- Plus `list_impersonation_personas()`: the SECURITY DEFINER read that powers the
-- picker. It is the only way the server can enumerate personas together with the
-- email needed to sign in as them (emails live in `auth.users`, which the auth'd
-- client can never read — mirrors why `admin_list_users` (0023) exists). It is
-- gated on the caller being a real admin OR an explicitly-flagged `can_impersonate`
-- profile, and it applies the anti-escalation scope IN THE DEFINER (not just the
-- UI): a non-admin caller sees teacher personas only; admin personas surface only
-- to a real admin.
--
-- NOTE ON PROVENANCE / APPLICATION: like 0012/0014/0023/0029, CC never applies
-- migrations — George runs this in the Supabase SQL editor. Every statement is
-- guarded (IF NOT EXISTS / CREATE OR REPLACE), so it is safe to re-run.
--
-- KEEPING GEORGE'S ACCESS UNBROKEN: the app still treats the
-- `TEST_IMPERSONATION_ALLOWED_UIDS` env allowlist as an eligibility fallback, so
-- the bar keeps rendering and "Return" keeps working for the current allowlisted
-- account regardless of these flags. BUT persona *enumeration* reads `auth.users`
-- through this definer, which cannot see the env allowlist — so to actually
-- populate the picker the caller must be a real admin or have `can_impersonate`
-- set. If the sole env-allowlisted account is not an admin, set
-- `can_impersonate = true` on its own profile row once (that is a manual, George
-- action — CC never sets these flags on anyone).

-- ── flags on profiles ────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists can_impersonate boolean not null default false;

alter table public.profiles
  add column if not exists is_test_persona boolean not null default false;

-- ── list_impersonation_personas ──────────────────────────────────────────────
-- Returns one row per impersonatable persona, scoped to the caller. `email` is
-- returned for server-side sign-in ONLY — the route strips it before anything
-- reaches the client. Raises (not silently empty) when the caller is ineligible,
-- so the caller can distinguish "not eligible" from "no personas seeded yet".
create or replace function public.list_impersonation_personas()
returns table (
  persona_id  uuid,
  full_name   text,
  email       text,
  role        public.user_role,
  centre_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Eligibility: a real admin, or a profile explicitly flagged can_impersonate.
  -- (The env-allowlist fallback lives in the app layer; SQL cannot see it.)
  if not (
    public.is_admin()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and can_impersonate
    )
  ) then
    raise exception 'Not authorized to list impersonation personas'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    p.role,
    centre.name
  from public.profiles p
  join auth.users u on u.id = p.id
  -- One representative centre name for display (a persona has a single seeded
  -- membership; pick deterministically if there were ever more).
  left join lateral (
    select s.name
    from public.subject_membership sm
    join public.schools s on s.id = sm.school_id
    where sm.profile_id = p.id
    order by s.name
    limit 1
  ) centre on true
  where p.is_test_persona
    -- Anti-escalation scope, enforced here (not only in the UI): a non-admin
    -- caller sees TEACHER personas only; coordinator/admin personas surface only
    -- to a real admin. Mirrors the role='teacher'-hardcoded self-provision RPC.
    and (public.is_admin() or p.role = 'teacher')
  order by p.full_name nulls last, u.email;
end;
$$;

-- Tightened grants (reads cross-user email): no public execute; the in-body gate
-- enforces admin-or-flagged. Mirrors admin_list_users / complete_onboarding.
revoke execute on function public.list_impersonation_personas() from public;
grant  execute on function public.list_impersonation_personas() to authenticated;
