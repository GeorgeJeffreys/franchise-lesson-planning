-- 0046_list_subject_members.sql
--
-- The READ source for the COORDINATOR-facing "Members & roles" tab. This is the
-- scoped sibling of `list_users_admin()` (0034/0041): where that one is the
-- global, admin-only, org-wide roster, this one returns ONLY the teachers within
-- the subject(s) the CALLER coordinates — never teachers in other subjects, never
-- other coordinators, never admins.
--
-- WHY A DEFINER RPC. The tab shows each teacher's email, and email lives in
-- `auth.users` (`profiles` has no email column) — only a definer can read it, and
-- only across the RLS boundary. So, exactly like `list_users_admin()`, this is
-- SECURITY DEFINER and reads `auth.users` as its owner. Unlike the admin RPC it is
-- NOT gated on `is_admin()`; instead the result is intrinsically scoped to the
-- caller's own `coordinator_subject` rows, so a non-coordinator (empty coordinated
-- set) gets zero rows and can never see another subject's people.
--
-- SCOPE / SHAPE — mirrors `list_users_admin()` where it overlaps:
--   • one row per DISTINCT teacher (not per membership row — the per-(school×subject)
--     cartesian is collapsed, since a coordinator's authority is school-agnostic).
--   • a teacher qualifies via a `subject_membership` row at `role = 'teacher'` whose
--     `subject_id` is one the caller coordinates. Coordinators live in
--     `coordinator_subject` (not `subject_membership`), and admins hold no spaces
--     (0041), so both are naturally excluded.
--   • `role` is the teacher's GLOBAL role from `profiles` (`user_role` — distinct
--     from the per-space `membership_role`), matching the admin RPC's convention.
--   • `spaces` is the teacher's coordinated-subject spaces only, each carrying the
--     `membership_ids` that a coordinator may delete (removing a teacher from that
--     subject across every school — the school-agnostic model). RLS `sm_coord_write`
--     is the real backstop on those deletes.
--
-- Security: SECURITY DEFINER, STABLE, pinned `set search_path = public`,
-- `revoke execute from public` + `grant execute to authenticated`. A deactivated
-- caller has no coordinator authority, so it raises (mirrors the deactivation guard
-- baked into `is_coordinator_of_subject`).
--
-- CC never applies migrations — George runs this in the Supabase SQL editor.
-- Idempotent (CREATE OR REPLACE): safe to re-run.

create or replace function public.list_subject_members()
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  role           text,
  is_deactivated boolean,
  spaces         jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- A deactivated caller holds no coordinator authority. Raise (rather than
  -- silently return empty) so the tab can tell "not authorized" from "no members".
  if public.is_deactivated() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  with my_subjects as (
    -- The caller's coordinated subjects — school-agnostic (coordinator_subject is
    -- the single source of truth post-0041). A non-coordinator has none, so every
    -- downstream join is empty and the function returns zero rows.
    select cs.subject_id
    from public.coordinator_subject cs
    where cs.profile_id = auth.uid()
  ),
  teacher_rows as (
    -- One row per (teacher, school) teacher-membership that falls inside a
    -- coordinated subject. Grouped per subject below.
    select
      sm.profile_id,
      sm.subject_id,
      sm.id        as membership_id,
      subj.name    as subject_name
    from public.subject_membership sm
    join my_subjects ms on ms.subject_id = sm.subject_id
    join public.subjects subj on subj.id = sm.subject_id
    where sm.role = 'teacher'
  )
  select
    tr.profile_id                          as user_id,
    p.full_name                            as full_name,
    u.email::text                          as email,
    coalesce(p.role::text, 'teacher')      as role,
    exists (
      select 1 from public.user_deactivation ud
      where ud.user_id = tr.profile_id
    )                                      as is_deactivated,
    (
      select jsonb_agg(sp order by sp->>'subject')
      from (
        select jsonb_build_object(
                 'subject_id',     g.subject_id,
                 'subject',        g.subject_name,
                 'membership_ids', g.membership_ids
               ) as sp
        from (
          select
            tr2.subject_id,
            tr2.subject_name,
            jsonb_agg(tr2.membership_id order by tr2.membership_id) as membership_ids
          from teacher_rows tr2
          where tr2.profile_id = tr.profile_id
          group by tr2.subject_id, tr2.subject_name
        ) g
      ) spaces
    )                                      as spaces
  from (select distinct profile_id from teacher_rows) tr
  join public.profiles p on p.id = tr.profile_id
  join auth.users     u on u.id = tr.profile_id
  order by p.full_name nulls last, u.email;
end;
$$;

revoke execute on function public.list_subject_members() from public;
grant  execute on function public.list_subject_members() to authenticated;
