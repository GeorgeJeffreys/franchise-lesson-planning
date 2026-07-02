-- 0031_admin_write_org_structure.sql
--
-- Admin-write RLS for the org-structure reference tables: subjects, schools,
-- classes. Until now these three were SELECT-only in the repo (0006_rls.sql):
-- authenticated users could read them, but no committed policy let anyone write.
-- The settings-console handlers in src/lib/actions/console.ts (createSubject,
-- createCentre / rename / archive / restore, createClass / update / archive /
-- restore) go through the auth'd, cookie-bound client, so they die at RLS with
-- nothing to satisfy. This migration adds exactly one `is_admin()`-gated write
-- policy per (table, command) so those handlers work.
--
-- SCOPE: INSERT + UPDATE only. No DELETE — the app is soft-delete (`archived_at`
-- via UPDATE); hard deletes stay out of the client path by decision.
--
-- Canonical policy names created here (one per table, per command):
--   subjects:  subjects_admin_insert, subjects_admin_update
--   schools:   schools_admin_insert,  schools_admin_update
--   classes:   classes_admin_insert,  classes_admin_update
--
-- Each policy is dropped-if-exists then recreated, so applying this in prod is
-- safe and idempotent.
--
-- PROD DRIFT — CHECK BEFORE/AFTER APPLYING: create-centre already works in
-- production (it inserts a school and seeds its classes), which means prod
-- carries hand-applied admin-write policies on `schools` and `classes` under
-- names that may DIFFER from the canonical ones above. `subjects` never got one
-- (that is the bug this fixes), and the repo committed none of the three. After
-- applying, inspect pg_policies for these tables and drop any stray write
-- policies so exactly one `is_admin()` policy remains per (table, command):
--
--   select tablename, policyname, cmd, qual, with_check
--     from pg_policies
--    where schemaname = 'public'
--      and tablename in ('subjects', 'schools', 'classes')
--    order by tablename, cmd, policyname;
--
-- Drop any write (INSERT/UPDATE/ALL) policy on these tables whose name is not in
-- the canonical list above, e.g.:  drop policy "<stray_name>" on public.<table>;
-- Leave the existing SELECT policies (schools/subjects/classes_select_authenticated)
-- untouched.
--
-- PRESERVED ELSEWHERE: the per-space `sm_admin_write` membership policy (0012)
-- already works and is not touched here.

-- ── subjects ──────────────────────────────────────────────────────────────────
drop policy if exists subjects_admin_insert on public.subjects;
create policy subjects_admin_insert
  on public.subjects for insert to authenticated
  with check (public.is_admin());

drop policy if exists subjects_admin_update on public.subjects;
create policy subjects_admin_update
  on public.subjects for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── schools ─────────────────────────────────────────────────────────────────
drop policy if exists schools_admin_insert on public.schools;
create policy schools_admin_insert
  on public.schools for insert to authenticated
  with check (public.is_admin());

drop policy if exists schools_admin_update on public.schools;
create policy schools_admin_update
  on public.schools for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── classes ─────────────────────────────────────────────────────────────────
drop policy if exists classes_admin_insert on public.classes;
create policy classes_admin_insert
  on public.classes for insert to authenticated
  with check (public.is_admin());

drop policy if exists classes_admin_update on public.classes;
create policy classes_admin_update
  on public.classes for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
