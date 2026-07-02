-- report_seed_references.sql
--
-- READ-ONLY. Run this BEFORE purge_seed_centres.sql and confirm every reference
-- count below is seed-only (ideally zero, or clearly test data) before deleting
-- anything. This script writes nothing — it only counts what references the four
-- SEED centres and their classes, so an operator can see whether any REAL
-- (non-seed) data would be destroyed by the purge.
--
-- CONTEXT. `supabase/admin/seed_centres_classes.sql` inserted four test centres —
-- 'Shatila 1', 'Shatila 2', 'Bourj 1', 'Bourj 2' — each with Year 1-6 English
-- classes, purely to populate the onboarding picker. They now sit in the prod
-- centres list beside the two REAL centres, which this script must NEVER touch:
--   • Shatila Centre            42c11721-c16b-4221-a945-473c028278b7
--   • Bourj al-Barajneh Centre  c87896b6-0f6d-4b20-bb32-1c31660645c1
--
-- SAFETY. Seed centres are resolved by NAME. If a resolved name maps to a real
-- centre id (an unexpected rename collision), the guard RAISEs and aborts before
-- printing anything — so this report can never quietly describe a real centre.
--
-- FK MAP counted here (all NO ACTION — none cascade from schools/classes, so each
-- would BLOCK a hard delete until cleared; see purge_seed_centres.sql for the
-- bottom-up order):
--   schools  <- classes.school_id            (0002)  -- the seed classes themselves
--   schools  <- subject_membership.school_id  (0012)
--   schools  <- profiles.school_id            (0002, nullable legacy column)
--   classes  <- class_teachers.class_id       (0002)
--   classes  <- lesson_plans.class_id         (0003)
--   (lesson_plans.school_id is a plain column for centre-scoped, class-less plans;
--    no FK. It may not exist in every environment, so it is checked dynamically.)
--   plan_comments / plan_events reference lesson_plans ON DELETE CASCADE, so they
--   are cleaned automatically when a seed plan is deleted — not counted separately.
--
-- Runs with the service-role connection (Supabase SQL editor or psql); bypasses
-- RLS. Never from a user request / anon key. Safe to re-run (read-only).

-- ── Guard + dynamic (centre-scoped plan) checks ───────────────────────────────
-- Emitted as NOTICEs (see the editor's "Messages" pane). The main result grid
-- follows.
do $$
declare
  v_ids           uuid[];
  v_real          uuid[] := array[
                     '42c11721-c16b-4221-a945-473c028278b7',
                     'c87896b6-0f6d-4b20-bb32-1c31660645c1'
                   ]::uuid[];
  v_has_lp_school boolean;
  v_centre        record;
  v_cnt           bigint;
  v_total         bigint := 0;
begin
  -- Resolve the four seed centres by name.
  select coalesce(array_agg(s.id), '{}')
    into v_ids
    from public.schools s
   where s.name in ('Shatila 1', 'Shatila 2', 'Bourj 1', 'Bourj 2');

  -- Never describe a real centre: abort if any resolved id is a known real id.
  if v_ids && v_real then
    raise exception
      'ABORT: a seed name resolved to a REAL centre id (%). Investigate before reporting.',
      (select array_agg(x) from unnest(v_ids) x where x = any(v_real));
  end if;

  raise notice 'Resolved % seed centre(s) by name: %', coalesce(array_length(v_ids, 1), 0), v_ids;

  -- lesson_plans.school_id (centre-scoped, class-less plans) — column may be absent.
  select exists (
           select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name   = 'lesson_plans'
              and column_name  = 'school_id'
         ) into v_has_lp_school;

  if not v_has_lp_school then
    raise notice 'lesson_plans.school_id column absent — no centre-scoped plans to check.';
  else
    for v_centre in
      select s.id, s.name
        from public.schools s
       where s.id = any(v_ids)
       order by s.name
    loop
      execute 'select count(*) from public.lesson_plans where school_id = $1'
        into v_cnt using v_centre.id;
      v_total := v_total + v_cnt;
      raise notice 'centre-scoped lesson_plans (lesson_plans.school_id = %  "%"): %',
        v_centre.id, v_centre.name, v_cnt;
    end loop;
    raise notice 'centre-scoped lesson_plans total across seed centres: %', v_total;
  end if;
end $$;

-- ── Per-centre reference grid ─────────────────────────────────────────────────
-- One row per seed centre. Any non-zero *_refs column that is NOT recognisable
-- test data means real data would be destroyed — stop and reconcile by hand.
with seed_centres as (
  select s.id, s.name
  from public.schools s
  where s.name in ('Shatila 1', 'Shatila 2', 'Bourj 1', 'Bourj 2')
),
seed_classes as (
  select c.id as class_id, c.school_id
  from public.classes c
  join seed_centres sc on sc.id = c.school_id
)
select
  sc.name                                                                as centre,
  sc.id                                                                  as centre_id,
  (select count(*) from public.classes c
      where c.school_id = sc.id)                                         as classes_total,
  (select count(*) from public.classes c
      where c.school_id = sc.id and c.archived_at is null)               as classes_active,
  (select count(*) from public.classes c
      where c.school_id = sc.id and c.archived_at is not null)           as classes_archived,
  (select count(*) from public.class_teachers ct
      join seed_classes x on x.class_id = ct.class_id
     where x.school_id = sc.id)                                          as class_teachers_refs,
  (select count(*) from public.lesson_plans lp
      join seed_classes x on x.class_id = lp.class_id
     where x.school_id = sc.id)                                          as lesson_plans_by_class,
  (select count(*) from public.subject_membership sm
      where sm.school_id = sc.id)                                        as subject_membership_refs,
  (select count(*) from public.profiles p
      where p.school_id = sc.id)                                         as profiles_school_id_refs
from seed_centres sc
order by sc.name;
