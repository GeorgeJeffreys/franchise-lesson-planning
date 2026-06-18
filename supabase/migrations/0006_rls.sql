-- 0006_rls.sql
-- Row Level Security. RLS is enabled on every table. Seeds and admin scripts use
-- the service-role key, which bypasses RLS; user requests use an auth'd client.

alter table public.schools          enable row level security;
alter table public.subjects         enable row level security;
alter table public.classes          enable row level security;
alter table public.profiles         enable row level security;
alter table public.class_teachers   enable row level security;
alter table public.lesson_plans     enable row level security;
alter table public.activity_bank    enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- A user may see and update only their own row. Inserts happen via the
-- handle_new_user trigger (security definer), so no client insert policy.
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── reference tables: read-only to any authenticated user ───────────────────
-- No write policies => no client writes (seeded/admin only).
create policy "schools_select_authenticated"
  on public.schools for select to authenticated using (true);

create policy "subjects_select_authenticated"
  on public.subjects for select to authenticated using (true);

create policy "classes_select_authenticated"
  on public.classes for select to authenticated using (true);

create policy "activity_bank_select_authenticated"
  on public.activity_bank for select to authenticated using (true);

-- ── class_teachers ──────────────────────────────────────────────────────────
-- A teacher may see their own assignments; no client writes.
create policy "class_teachers_select_own"
  on public.class_teachers for select to authenticated
  using (teacher_id = (select auth.uid()));

-- ── lesson_plans ────────────────────────────────────────────────────────────
-- A user may read/insert/update a plan they created OR a plan for a class they
-- are assigned to. Inserts must set created_by = auth.uid(). No client deletes.
create policy "lesson_plans_select_own_or_assigned"
  on public.lesson_plans for select to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = lesson_plans.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );

create policy "lesson_plans_insert_self"
  on public.lesson_plans for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "lesson_plans_update_own_or_assigned"
  on public.lesson_plans for update to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = lesson_plans.class_id
        and ct.teacher_id = (select auth.uid())
    )
  )
  with check (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = lesson_plans.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );
