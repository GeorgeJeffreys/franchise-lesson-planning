-- cleanup_lesson_plans.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Clear demo / sample lesson-plan data before a fresh team test.
--
-- WHAT THIS TOUCHES:  lesson_plans and everything that hangs off a plan —
--   • plan blocks          → the `blocks` JSONB column ON the lesson_plans row
--                            (there is NO separate plan_blocks table; blocks are
--                            deleted with the plan row itself)
--   • coordinator comments → public.plan_comments   (FK plan_id, ON DELETE CASCADE)
--   • lifecycle / review    → public.plan_events     (FK plan_id, ON DELETE CASCADE)
--   • plan-tied activity     → public.resource_usage  (FK lesson_plan_id, *NO cascade*
--                            — MUST be deleted first or the parent delete errors)
--
-- WHAT THIS PRESERVES (never referenced below):
--   curriculum_lesson + all curriculum tables, profiles / auth.users,
--   subject_membership, ai_resource_guide, smartt_objective_guide, term_calendar,
--   schools (centres), subjects, classes, class_teachers, activity_bank,
--   resources / folders / folder_resources, and any resource_usage row NOT tied to
--   a deleted plan (lesson_plan_id IS NULL rows are left untouched).
--
-- ORDER OF OPERATIONS:
--   RUN AFTER the ownership migration (0028_lesson_plans_per_teacher_unique.sql).
--   This script only reads/deletes data; it does not depend on the new indexes,
--   but it is authored to run in that post-migration world.
--
-- HOW TO USE:
--   1. Run STEP 1 (all SELECTs) and confirm the scope/counts.
--   2. Run STEP 2 (the DELETEs) inside the BEGIN/COMMIT block. Review, then COMMIT
--      (or ROLLBACK to abort — nothing is permanent until COMMIT).
--
-- ── SCOPE ──────────────────────────────────────────────────────────────────────
--   DEFAULT = ALL plans (full wipe).
--   Every plan-selecting predicate below is written as:  true /* SCOPE */
--   To NARROW the scope, find-and-replace EVERY occurrence of  `true /* SCOPE */`
--   with your own predicate against public.lesson_plans, e.g.:
--
--     -- keep Connie's plans, delete everyone else's:
--     created_by <> (select id from public.profiles where full_name = 'Connie Example') /* SCOPE */
--
--     -- delete ONLY Connie's plans:
--     created_by = (select id from public.profiles where full_name = 'Connie Example') /* SCOPE */
--
--     -- delete only a status, or only a date range:
--     status = 'in_progress' /* SCOPE */
--     lesson_date < date '2026-07-01' /* SCOPE */
--
--   Keep the predicate identical in ALL FOUR places (the three child deletes and
--   the parent delete, plus the preview counts) so preview and delete agree.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════ STEP 1 — PREVIEW (SELECT ONLY) ═══════════════
-- Nothing here modifies data. Run all three and confirm before STEP 2.

-- 1a. SANITY CHECK — enumerate EVERY foreign key that points at lesson_plans.
--     The live schema has hand-applied objects not fully mirrored in-repo
--     (see 0028 pre-flight notes), so confirm the three expected dependents below
--     are the ONLY ones. If this returns a table not handled in STEP 2, stop and
--     add a matching delete before proceeding.
select
  con.conrelid::regclass          as child_table,
  att.attname                     as child_column,
  con.confdeltype                 as on_delete,   -- 'c'=cascade 'a'=no action 'r'=restrict 'n'=set null
  con.conname                     as constraint_name
from pg_constraint con
join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
join pg_attribute att
  on att.attrelid = con.conrelid and att.attnum = k.attnum
where con.contype = 'f'
  and con.confrelid = 'public.lesson_plans'::regclass
order by child_table, child_column;

-- 1b. ROW COUNTS to be deleted, per table, under the current SCOPE.
--     (resource_usage counts only rows tied to an in-scope plan; NULL-plan usage
--     is excluded and preserved.)
select 'lesson_plans'   as table_name,
       count(*)         as rows_to_delete
  from public.lesson_plans
 where true /* SCOPE */
union all
select 'plan_comments',
       count(*)
  from public.plan_comments
 where plan_id in (select id from public.lesson_plans where true /* SCOPE */)
union all
select 'plan_events',
       count(*)
  from public.plan_events
 where plan_id in (select id from public.lesson_plans where true /* SCOPE */)
union all
select 'resource_usage',
       count(*)
  from public.resource_usage
 where lesson_plan_id in (select id from public.lesson_plans where true /* SCOPE */)
order by table_name;

-- 1c. PLAN BREAKDOWN by author (name + status + count), so you can confirm exactly
--     whose plans are in scope before deleting. NULL full_name falls back to the id.
select
  coalesce(pr.full_name, lp.created_by::text) as author,
  lp.status,
  count(*)                                    as plans
  from public.lesson_plans lp
  left join public.profiles pr on pr.id = lp.created_by
 where true /* SCOPE */
 group by coalesce(pr.full_name, lp.created_by::text), lp.status
 order by author, lp.status;


-- ════════════════════════════════ STEP 2 — DELETE (FK-SAFE ORDER) ══════════════
-- Children before parent. resource_usage FIRST (no cascade → would block the
-- parent delete). plan_comments / plan_events would cascade automatically, but are
-- deleted explicitly here for clear, counted control. Wrapped in a transaction:
-- review the RETURNING/rowcounts, then COMMIT — or ROLLBACK to abort cleanly.

begin;

-- 2a. plan-tied resource usage (MUST precede the parent delete).
delete from public.resource_usage
 where lesson_plan_id in (select id from public.lesson_plans where true /* SCOPE */);

-- 2b. coordinator comments.
delete from public.plan_comments
 where plan_id in (select id from public.lesson_plans where true /* SCOPE */);

-- 2c. lifecycle / review audit events.
delete from public.plan_events
 where plan_id in (select id from public.lesson_plans where true /* SCOPE */);

-- 2d. the plans themselves (removes the `blocks` JSONB with each row).
delete from public.lesson_plans
 where true /* SCOPE */;

-- Review the affected row counts above, then:
commit;
-- rollback;   -- ← use this instead of commit to abort without changing anything.

-- ── OPTIONAL: reconcile resources.usage_count ──────────────────────────────────
-- Deleting resource_usage does NOT decrement the denormalised resources.usage_count
-- (that counter is only bumped on INSERT, via bump_resource_usage_count). If you
-- want the aggregate to match the surviving usage rows after the wipe, run:
--
--   update public.resources r
--      set usage_count = (
--        select count(*) from public.resource_usage u where u.resource_id = r.id
--      );
