-- 0033_enforce_deactivation.sql
--
-- Global user administration, part 2 of 4: ENFORCE deactivation. ⚠️ CORE AUTH —
-- this migration rewrites the three access helpers that gate every RLS policy in
-- the app. Review carefully.
--
-- Requires 0032 (`is_deactivated()`). The predicate added everywhere below is a
-- single expression — `not public.is_deactivated()` — so "deactivated" means the
-- same thing in every access path. A deactivated user keeps their memberships
-- (nothing is deleted) but the helpers now return FALSE for them, so every policy
-- that routes through a helper denies access. Reactivation (deleting the
-- user_deactivation row, 0035) restores everything losslessly.
--
-- SCOPE OF THE PREDICATE — set by a Phase-0 audit of every access-granting
-- policy. The goal (George's bar): a deactivated user can NOT read or mutate any
-- shared-workspace data, nor act on other members/spaces. Two residuals are
-- explicitly accepted: (a) the user's OWN private rows/drafts (own-row policies
-- keyed on created_by/uploaded_by/owner_id/used_by), and (b) public/reference
-- reads every authenticated user can already see (schools/subjects/classes/
-- activity_bank/curriculum/terms `select`, and the resource-bank `select`s).
--
--   Routes through a helper already → covered automatically by rewriting the
--   helper: subject_membership (sm_*), lesson_plans (lp_member_all), plan_comments
--   / plan_events (via is_member_of_plan / is_coordinator_of_plan, which wrap the
--   three helpers), term-calendar writes, org-structure writes (0031), the
--   AI/SMARTT guide policies, and impersonation personas.
--
--   Does NOT route through a helper (the Phase-0 STOP findings) → fixed here:
--     1. `shares_subject_space()` (0013) queries subject_membership DIRECTLY to
--        power `profiles_select_comember` (co-member profile reads). Predicate
--        added to its body below.
--     2. resource-bank COORDINATOR policies (0008) check `profiles.role =
--        'coordinator'` DIRECTLY (not via is_coordinator_of_subject). Predicate
--        added INLINE to each below, so a deactivated ex-coordinator can no longer
--        read/mutate OTHER people's bank rows. (Per George: added inline, NOT
--        refactored onto the membership helper — lower risk for a core-auth
--        change. The duplication — ~10 policies re-implementing a role check
--        instead of calling is_coordinator_of_subject — is noted for a later,
--        separate cleanup and is out of scope here.)
--
-- CC never applies migrations — George runs this in the Supabase SQL editor.
-- Idempotent (CREATE OR REPLACE / DROP … IF EXISTS): safe to re-run.

-- ── the three access helpers ─────────────────────────────────────────────────
-- Exact original logic preserved (see 0012); the ONLY change is the leading
-- `(not public.is_deactivated()) and …` guard. Signatures, language, volatility,
-- and search_path are unchanged so every existing caller/policy is unaffected.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_deactivated()) and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_member_of_subject(p_school uuid, p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_deactivated()) and exists (
    select 1 from public.subject_membership
    where profile_id = auth.uid()
      and school_id = p_school
      and subject_id = p_subject
  );
$$;

create or replace function public.is_coordinator_of_subject(p_school uuid, p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_deactivated()) and exists (
    select 1 from public.subject_membership
    where profile_id = auth.uid()
      and school_id = p_school
      and subject_id = p_subject
      and role = 'coordinator'
  );
$$;

-- ── shares_subject_space() — Phase-0 finding #1 ──────────────────────────────
-- Exact original logic preserved (see 0013); the ONLY change is the leading
-- guard. Without this, a deactivated user could still read co-members' profiles
-- via `profiles_select_comember`.
create or replace function public.shares_subject_space(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_deactivated()) and exists (
    select 1
    from public.subject_membership me
    join public.subject_membership them
      on them.school_id = me.school_id
     and them.subject_id = me.subject_id
    where me.profile_id = auth.uid()
      and them.profile_id = p_profile
  );
$$;

-- ── resource-bank coordinator policies — Phase-0 finding #2 ───────────────────
-- Each policy below is the EXACT original (0008) wrapped as
-- `(not public.is_deactivated()) and ( <original> )`. Drop-then-create keeps this
-- idempotent and mirrors the repo's policy-edit style. The own-row branch is
-- inside the wrap too, so a deactivated user cannot touch the shared bank at all
-- (the bank is shared, not private — so this is not one of the accepted own-row
-- residuals). The `select … using (true)` read policies are left unchanged
-- (accepted public-read residual).

drop policy if exists "resources_update_own_or_coordinator" on public.resources;
create policy "resources_update_own_or_coordinator"
  on public.resources for update to authenticated
  using (
    (not public.is_deactivated()) and (
      uploaded_by = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  )
  with check (
    (not public.is_deactivated()) and (
      uploaded_by = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  );

drop policy if exists "resources_delete_own_or_coordinator" on public.resources;
create policy "resources_delete_own_or_coordinator"
  on public.resources for delete to authenticated
  using (
    (not public.is_deactivated()) and (
      uploaded_by = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  );

drop policy if exists "resource_tags_insert_coordinator" on public.resource_tags;
create policy "resource_tags_insert_coordinator"
  on public.resource_tags for insert to authenticated
  with check (
    (not public.is_deactivated()) and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

drop policy if exists "resource_tags_update_coordinator" on public.resource_tags;
create policy "resource_tags_update_coordinator"
  on public.resource_tags for update to authenticated
  using (
    (not public.is_deactivated()) and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  )
  with check (
    (not public.is_deactivated()) and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

drop policy if exists "resource_tags_delete_coordinator" on public.resource_tags;
create policy "resource_tags_delete_coordinator"
  on public.resource_tags for delete to authenticated
  using (
    (not public.is_deactivated()) and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

drop policy if exists "resource_tag_links_insert_editable_resource" on public.resource_tag_links;
create policy "resource_tag_links_insert_editable_resource"
  on public.resource_tag_links for insert to authenticated
  with check (
    (not public.is_deactivated()) and exists (
      select 1 from public.resources r
      where r.id = resource_tag_links.resource_id
        and (
          r.uploaded_by = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'coordinator'
          )
        )
    )
  );

drop policy if exists "resource_tag_links_delete_editable_resource" on public.resource_tag_links;
create policy "resource_tag_links_delete_editable_resource"
  on public.resource_tag_links for delete to authenticated
  using (
    (not public.is_deactivated()) and exists (
      select 1 from public.resources r
      where r.id = resource_tag_links.resource_id
        and (
          r.uploaded_by = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'coordinator'
          )
        )
    )
  );

drop policy if exists "resources_storage_update_own_or_coordinator" on storage.objects;
create policy "resources_storage_update_own_or_coordinator"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resources'
    and (not public.is_deactivated())
    and (
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  )
  with check (
    bucket_id = 'resources'
    and (not public.is_deactivated())
    and (
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  );

drop policy if exists "resources_storage_delete_own_or_coordinator" on storage.objects;
create policy "resources_storage_delete_own_or_coordinator"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resources'
    and (not public.is_deactivated())
    and (
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  );

-- ── self-provision guard (brief item 6) ──────────────────────────────────────
-- The onboarding self-provision RPC must refuse to act for a deactivated user.
-- Exact original logic preserved (see 0029); the ONLY change is the added
-- deactivation check right after the sign-in check. So a deactivated user who
-- re-authenticates via Entra and lands on /onboarding cannot re-grant themselves
-- any membership or class.
create or replace function public.complete_onboarding(
  p_centre_id   uuid,
  p_subject_ids uuid[],
  p_class_ids   uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_subject uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Deactivation guard: a deactivated user cannot self-provision access.
  if public.is_deactivated() then
    raise exception 'Your access has been deactivated' using errcode = '42501';
  end if;

  if p_centre_id is null then
    raise exception 'A centre is required';
  end if;
  if p_subject_ids is null or array_length(p_subject_ids, 1) is null then
    raise exception 'At least one subject is required';
  end if;

  foreach v_subject in array p_subject_ids loop
    insert into public.subject_membership (profile_id, school_id, subject_id, role)
    values (v_uid, p_centre_id, v_subject, 'teacher')
    on conflict (profile_id, school_id, subject_id) do nothing;
  end loop;

  if p_class_ids is not null and array_length(p_class_ids, 1) is not null then
    insert into public.class_teachers (class_id, teacher_id)
    select c.id, v_uid
    from public.classes c
    where c.id = any(p_class_ids)
      and c.school_id = p_centre_id
      and c.subject_id = any(p_subject_ids)
    on conflict (class_id, teacher_id) do nothing;
  end if;
end;
$$;
