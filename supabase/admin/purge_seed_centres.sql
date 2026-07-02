-- purge_seed_centres.sql
--
-- ⚠️ DESTRUCTIVE — HARD DELETE. Removes the four SEED centres and their classes
-- (and the rows that reference them) from prod. There is no soft-delete here: the
-- goal is to get the test centres OFF the centres list entirely.
--
-- ▶ RUN report_seed_references.sql FIRST and confirm every reference count is
--   seed-only. This script deletes whatever references the seed centres/classes;
--   if a real teacher's membership, plan, or class_teacher link points at a seed
--   centre, THAT real row is deleted too. The report is the gate — do not run
--   this until those counts are confirmed seed-only.
--
-- SCOPE. Exactly the four seed centres, resolved by NAME —
--   'Shatila 1', 'Shatila 2', 'Bourj 1', 'Bourj 2' — and nothing else. The two
--   REAL centres are never touched, and the script ABORTs (rolls back the whole
--   transaction) if any resolved seed id equals a known real id:
--     • Shatila Centre            42c11721-c16b-4221-a945-473c028278b7
--     • Bourj al-Barajneh Centre  c87896b6-0f6d-4b20-bb32-1c31660645c1
--
-- ATOMICITY. Wrapped in ONE transaction. No FK in the schools/classes graph
-- cascades (all NO ACTION), so deletes are explicit and bottom-up:
--     lesson_plans (by seed class_id, and by seed school_id if that column exists)
--       └─ plan_comments / plan_events auto-cascade from lesson_plans
--   → class_teachers (by seed class_id)
--   → subject_membership (by seed school_id)
--   → profiles.school_id  (nulled, not deleted — legacy nullable column)
--   → classes (seed)
--   → schools (seed)
-- If any UNEXPECTED FK still references a row (something outside the mapped
-- graph), that delete raises inside the transaction and the WHOLE thing rolls
-- back — nothing partial. Fix the reference, re-run the report, then re-run this.
--
-- Runs with the service-role connection (Supabase SQL editor or psql); bypasses
-- RLS. Never from a user request / anon key. Re-running after a successful purge
-- is a harmless no-op (the seed centres are already gone → zero ids resolved).

begin;

do $$
declare
  v_ids           uuid[];
  v_real          uuid[] := array[
                     '42c11721-c16b-4221-a945-473c028278b7',
                     'c87896b6-0f6d-4b20-bb32-1c31660645c1'
                   ]::uuid[];
  v_has_lp_school boolean;
  v_lp_class      bigint;
  v_lp_school     bigint := 0;
  v_ct            bigint;
  v_sm            bigint;
  v_prof          bigint;
  v_classes       bigint;
  v_centres       bigint;
begin
  -- Resolve the four seed centres by name.
  select coalesce(array_agg(s.id), '{}')
    into v_ids
    from public.schools s
   where s.name in ('Shatila 1', 'Shatila 2', 'Bourj 1', 'Bourj 2');

  -- Anti-footgun: never delete a real centre. Abort (rolls back) on any collision.
  if v_ids && v_real then
    raise exception
      'ABORT: a seed name resolved to a REAL centre id (%). Refusing to delete.',
      (select array_agg(x) from unnest(v_ids) x where x = any(v_real));
  end if;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise notice 'No seed centres found (already purged?). Nothing to do.';
    return;
  end if;

  raise notice 'Purging % seed centre(s): %', array_length(v_ids, 1), v_ids;

  -- 1a. lesson_plans referencing a seed CLASS (cascades to plan_comments/plan_events).
  delete from public.lesson_plans lp
   where lp.class_id in (
     select c.id from public.classes c where c.school_id = any(v_ids)
   );
  get diagnostics v_lp_class = row_count;

  -- 1b. lesson_plans referencing a seed CENTRE directly (class-less, centre-scoped
  --     plans). The column may not exist in every environment — guard dynamically.
  select exists (
           select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name   = 'lesson_plans'
              and column_name  = 'school_id'
         ) into v_has_lp_school;
  if v_has_lp_school then
    execute 'delete from public.lesson_plans where school_id = any($1)' using v_ids;
    get diagnostics v_lp_school = row_count;
  end if;

  -- 2. class_teachers links for seed classes.
  delete from public.class_teachers ct
   where ct.class_id in (
     select c.id from public.classes c where c.school_id = any(v_ids)
   );
  get diagnostics v_ct = row_count;

  -- 3. subject_membership rows in seed centres.
  delete from public.subject_membership sm
   where sm.school_id = any(v_ids);
  get diagnostics v_sm = row_count;

  -- 4. profiles.school_id (legacy nullable FK) — null it out, don't delete the user.
  update public.profiles p
     set school_id = null
   where p.school_id = any(v_ids);
  get diagnostics v_prof = row_count;

  -- 5. the seed classes themselves.
  delete from public.classes c
   where c.school_id = any(v_ids);
  get diagnostics v_classes = row_count;

  -- 6. the seed centres.
  delete from public.schools s
   where s.id = any(v_ids);
  get diagnostics v_centres = row_count;

  raise notice 'Deleted: lesson_plans(by class)=%, lesson_plans(by centre)=%, class_teachers=%, subject_membership=%, profiles.school_id nulled=%, classes=%, schools=%',
    v_lp_class, v_lp_school, v_ct, v_sm, v_prof, v_classes, v_centres;
end $$;

commit;
