-- 0040_coordinator_subject.sql
--
-- Role-first access model, migration 1 of 2 (schema + readers). ⚠️ CORE AUTH —
-- this rewrites three of the access helpers that gate every RLS policy, so review
-- carefully. Migration 2 (the data backfill) is authored separately, AFTER the
-- reconciliation counts are run against live data; this migration is safe to apply
-- on its own and leaves all existing behaviour intact (it only ADDS a second way to
-- be a coordinator).
--
-- WHY. The "Edit access" model becomes role-first: a person is Admin, Teacher, or
-- Coordinator. Teacher access stays exactly as-is — cartesian (school × subject)
-- rows in `subject_membership` at role='teacher'. But a Coordinator now manages
-- their subject across ALL schools, present and future. The live
-- `is_coordinator_of_subject(school, subject)` is school-SPECIFIC (it matches a row
-- at that one school), so per-school `subject_membership` coordinator rows could
-- only ever be a snapshot, never the "all schools" rule the design promises. This
-- migration moves coordinator-ness into a school-agnostic table,
-- `coordinator_subject(profile_id, subject_id)`, and teaches the readers to honour
-- it — while leaving `subject_membership` and every teacher/plan/comment path on it
-- provably untouched.
--
-- TRANSITIONAL. `subject_membership` may still hold legacy role='coordinator' rows
-- until migration 2 backfills them into `coordinator_subject` and deletes them.
-- Every reader below therefore honours BOTH sources (new table OR legacy rows), so
-- nobody's coordinator status changes between this migration and the backfill.
-- Migration 2 drops the legacy branch once those rows are gone.
--
-- CC never applies migrations — George runs this in the Supabase SQL editor.
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS): safe to re-run.

-- ── coordinator_subject ──────────────────────────────────────────────────────
-- School-agnostic by construction: one row = "this person coordinates this subject
-- at every school." No school_id column at all, so "all schools" cannot drift and a
-- newly-added school is covered automatically.
create table if not exists public.coordinator_subject (
  profile_id uuid not null references public.profiles on delete cascade,
  subject_id uuid not null references public.subjects,
  created_at timestamptz not null default now(),
  primary key (profile_id, subject_id)
);

create index if not exists coordinator_subject_subject_idx
  on public.coordinator_subject (subject_id);

-- ── RLS on coordinator_subject ───────────────────────────────────────────────
alter table public.coordinator_subject enable row level security;

-- Admins may write (grant/revoke) any coordinator row. Mirrors sm_admin_write.
-- membership_role has no bearing here; there is no coordinator-writes-coordinator
-- path — minting an all-schools coordinator is an org-level act, so it is
-- admin-only (the Users-tab "Edit access" modal is the single writer).
drop policy if exists cs_admin_write on public.coordinator_subject;
create policy cs_admin_write
  on public.coordinator_subject for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Read: a user sees their own coordinator rows (so the settings console can resolve
-- their coordinated subjects via the auth'd client); admins see all. The definer
-- helpers below read this table as their owner, so they do NOT depend on this
-- policy and cannot recurse through it.
drop policy if exists cs_self_read on public.coordinator_subject;
create policy cs_self_read
  on public.coordinator_subject for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- ── the three access readers — OR-in coordinator_subject ─────────────────────
-- Each keeps its exact prior logic (the deactivation guard from 0033 and, for the
-- coordinator/member helpers, the legacy per-school subject_membership branch) and
-- adds a school-agnostic coordinator_subject branch. Signatures, language,
-- volatility, and search_path are unchanged, so every existing caller/policy that
-- routes through these (is_member_of_plan, is_coordinator_of_plan,
-- enforce_approval_role, lp_member_all, plan_comments/plan_events, set_my_classes,
-- profiles_select_comember) is covered automatically.

-- A coordinator is a MEMBER of their subject at every school — this is what
-- delivers "all schools" for plan read/edit (which flows through this helper). The
-- coordinator_subject branch ignores p_school by design.
create or replace function public.is_member_of_subject(p_school uuid, p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_deactivated()) and (
    exists (
      select 1 from public.subject_membership
      where profile_id = auth.uid()
        and school_id = p_school
        and subject_id = p_subject
    )
    or exists (
      select 1 from public.coordinator_subject
      where profile_id = auth.uid()
        and subject_id = p_subject
    )
  );
$$;

create or replace function public.is_coordinator_of_subject(p_school uuid, p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_deactivated()) and (
    exists (
      select 1 from public.coordinator_subject
      where profile_id = auth.uid()
        and subject_id = p_subject
    )
    -- Legacy per-school coordinator row (transitional; removed in migration 2).
    or exists (
      select 1 from public.subject_membership
      where profile_id = auth.uid()
        and school_id = p_school
        and subject_id = p_subject
        and role = 'coordinator'
    )
  );
$$;

-- shares_subject_space powers profiles_select_comember (co-member profile reads).
-- Teacher↔teacher co-membership stays school-AND-subject specific (unchanged). A
-- coordinator, being all-schools, shares a space with anyone who participates in
-- that subject at any school (as member or fellow coordinator) — so a coordinator
-- and their subject's teachers can read each other's profiles.
create or replace function public.shares_subject_space(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_deactivated()) and (
    -- Both are members of the same (school, subject).
    exists (
      select 1
      from public.subject_membership me
      join public.subject_membership them
        on them.school_id = me.school_id
       and them.subject_id = me.subject_id
      where me.profile_id = auth.uid()
        and them.profile_id = p_profile
    )
    -- I coordinate a subject the other participates in (any school).
    or exists (
      select 1
      from public.coordinator_subject me
      where me.profile_id = auth.uid()
        and (
          exists (
            select 1 from public.subject_membership t
            where t.profile_id = p_profile and t.subject_id = me.subject_id
          )
          or exists (
            select 1 from public.coordinator_subject t
            where t.profile_id = p_profile and t.subject_id = me.subject_id
          )
        )
    )
    -- The other coordinates a subject I participate in (any school).
    or exists (
      select 1
      from public.coordinator_subject them
      where them.profile_id = p_profile
        and (
          exists (
            select 1 from public.subject_membership m
            where m.profile_id = auth.uid() and m.subject_id = them.subject_id
          )
          or exists (
            select 1 from public.coordinator_subject m
            where m.profile_id = auth.uid() and m.subject_id = them.subject_id
          )
        )
    )
  );
$$;

-- ── list_users_admin() — emit coordinator entries school-agnostically ─────────
-- Same signature and admin hard-gate as 0038. The `spaces` array now unions:
--   • teacher entries: one per subject_membership row at role='teacher' (school +
--     subject ids, centre + subject names, membership_id) — as before.
--   • coordinator entries: one per DISTINCT coordinated subject, sourced from
--     coordinator_subject UNIONed with any legacy subject_membership role=
--     'coordinator' rows (transitional), rendered school-agnostically
--     (school_id/centre/membership_id = null). So a coordinator shows a single
--     `Subject · Coordinator` chip, and the modal pre-ticks the Subjects group —
--     never N per-school rows.
-- Return-table signature is unchanged (still ends in `spaces jsonb`), so this is a
-- plain CREATE OR REPLACE.
create or replace function public.list_users_admin()
returns table (
  user_id         uuid,
  full_name       text,
  email           text,
  is_admin        boolean,
  is_deactivated  boolean,
  can_impersonate boolean,
  spaces          jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    u.id                                   as user_id,
    p.full_name                            as full_name,
    u.email::text                          as email,
    coalesce(p.role = 'admin', false)      as is_admin,
    exists (
      select 1 from public.user_deactivation ud
      where ud.user_id = u.id
    )                                      as is_deactivated,
    coalesce(p.can_impersonate, false)     as can_impersonate,
    coalesce(
      (
        select jsonb_agg(sp order by subject_name nulls last, role_ord, centre_name nulls last)
        from (
          -- Teacher spaces: one per (school, subject) membership row.
          select
            jsonb_build_object(
              'membership_id', sm.id,
              'school_id',     sm.school_id,
              'subject_id',    sm.subject_id,
              'subject',       subj.name,
              'role',          sm.role,
              'centre',        s.name
            )               as sp,
            subj.name        as subject_name,
            sm.role::text    as role_ord,
            s.name           as centre_name
          from public.subject_membership sm
          join public.subjects subj on subj.id = sm.subject_id
          join public.schools  s    on s.id    = sm.school_id
          where sm.profile_id = u.id
            and sm.role = 'teacher'

          union all

          -- Coordinator subjects: school-agnostic, deduped across both sources.
          select
            jsonb_build_object(
              'membership_id', null,
              'school_id',     null,
              'subject_id',    cs.subject_id,
              'subject',       subj.name,
              'role',          'coordinator',
              'centre',        null
            )                as sp,
            subj.name        as subject_name,
            'coordinator'    as role_ord,
            null::text       as centre_name
          from (
            select subject_id from public.coordinator_subject where profile_id = u.id
            union
            select subject_id from public.subject_membership
            where profile_id = u.id and role = 'coordinator'
          ) cs
          join public.subjects subj on subj.id = cs.subject_id
        ) sp_rows
      ),
      '[]'::jsonb
    )                                      as spaces
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by p.full_name nulls last, u.email;
end;
$$;

revoke execute on function public.list_users_admin() from public;
grant  execute on function public.list_users_admin() to authenticated;
