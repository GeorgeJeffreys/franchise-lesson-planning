-- seed_one_plan.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Insert ONE in-progress lesson plan so the Lesson Plan Editor (/plan/[id]) is
-- testable on its own branch, before the plan-creation flow exists.
--
-- It targets the seeded Shatila Centre · Year 2 · Group A (mixed-literacy) class
-- and uses curriculum lesson 1.S5.K0.H2 — a real Year 2 Reading lesson, theme
-- "Food and drinks" — so the header's curriculum context resolves.
--
-- This is an ADMIN script (run with the service-role connection): it inserts a
-- row for an arbitrary teacher and bypasses RLS. NEVER run it from a user
-- request or with the anon key.
--
-- Prerequisites:
--   1. Migrations + seed.sql applied (supabase db reset).
--   2. The teacher has signed in once (handle_new_user created their profile).
--   3. The teacher is assigned to the Shatila Year 2 class — run
--      supabase/admin/assign_teacher.sql first (it assigns all Shatila classes).
--
-- ── Run note ────────────────────────────────────────────────────────────────
--   psql "$DATABASE_URL" \
--     -v teacher_uid="'00000000-0000-0000-0000-000000000000'" \
--     -f supabase/admin/seed_one_plan.sql
--   It prints the new plan id; open /plan/<that-id>.
--   (Supabase SQL editor: replace :'teacher_uid' below with a literal uuid.)
-- ───────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

begin;

-- Resolve the target Year 2 Group A class at Shatila Centre, English.
create temporary table _ctx on commit drop as
select
  :'teacher_uid'::uuid as teacher_id,
  c.id as class_id
from public.classes c
join public.schools s  on s.id  = c.school_id
join public.subjects su on su.id = c.subject_id
where s.name = 'Shatila Centre'
  and su.code = 'english'
  and c.year = 2
  and c.group_label = 'A';

do $$
begin
  if (select count(*) from _ctx) = 0 then
    raise exception 'Target class not found — has seed.sql been applied?';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = (select teacher_id from _ctx)
  ) then
    raise exception 'No profile for that uid — has the teacher signed in once?';
  end if;
  if not exists (
    select 1 from public.class_teachers ct
    where ct.class_id = (select class_id from _ctx)
      and ct.teacher_id = (select teacher_id from _ctx)
  ) then
    raise exception
      'Teacher is not assigned to the Year 2 class — run assign_teacher.sql first.';
  end if;
end $$;

-- Insert one in-progress plan with the canonical DEFAULT_BLOCKS scaffold.
-- (class_id, lesson_date) is unique; re-running with the same date is a no-op.
insert into public.lesson_plans
  (class_id, curriculum_lesson_id, lesson_date, period, status, blocks, created_by)
select
  ctx.class_id,
  '1.S5.K0.H2',
  date '2026-06-18',
  2,
  'in_progress',
  $blocks$[
    {"type":"anthem","title":"Alsama Anthem","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":"we_do","duration_minutes":1},
    {"type":"warm_up","title":"Warm-up","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":"we_do","duration_minutes":1},
    {"type":"cool_down","title":"Cool down","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":"we_do","duration_minutes":1},
    {"type":"check_homework","title":"Check homework","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":null,"duration_minutes":2},
    {"type":"recap","title":"Recap","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":null,"duration_minutes":5},
    {"type":"new_content","title":"New Content / Skill","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":"i_do","duration_minutes":10},
    {"type":"cfu","title":"Check for Understanding","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":null,"duration_minutes":5},
    {"type":"independent_practice","title":"Independent or Group Practice","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":"you_do","duration_minutes":20},
    {"type":"exit_ticket","title":"Exit Ticket","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":null,"duration_minutes":5},
    {"type":"homework","title":"Homework","activity_title":"","activity_ref":null,"teacher_does":"","students_do":"","resources":"","phase":null,"duration_minutes":0}
  ]$blocks$::jsonb,
  ctx.teacher_id
from _ctx ctx
on conflict (class_id, lesson_date) do nothing;

-- Show the plan id to open at /plan/<id>.
select lp.id as plan_id, lp.status, lp.lesson_date, lp.curriculum_lesson_id
from public.lesson_plans lp
join _ctx ctx on ctx.class_id = lp.class_id
where lp.lesson_date = date '2026-06-18';

commit;
