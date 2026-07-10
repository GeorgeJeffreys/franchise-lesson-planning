-- 0059_curriculum_lesson_key_version_scoped_unique.sql
--
-- Finishes 0056. Migration 0056 moved curriculum_lesson uniqueness to VERSION scope so
-- a re-authored subject can publish a NEW version whose rows legitimately reuse the same
-- lesson_keys as the prior version. It dropped the 0010 inline `unique (lesson_key)`
-- CONSTRAINT (curriculum_lesson_lesson_key_key) and added the composite
-- curriculum_lesson_version_lesson_key_uidx (curriculum_version_id, lesson_key) — but it
-- LEFT IN PLACE the separate standalone unique INDEX from 0015,
-- `curriculum_lesson_lesson_key_uidx` on (lesson_key) alone. That leftover index still
-- enforces GLOBAL lesson_key uniqueness, so publishing a second version whose keys
-- overlap the first (any real subject revision does) fails with:
--   duplicate key value violates unique constraint "curriculum_lesson_lesson_key_uidx"
-- (professionalism V4 reuses ~160 of v1's keys — the first real second-version publish,
-- which is why this only surfaces now).
--
-- FIX: drop the leftover global (lesson_key) index. Per-version uniqueness is preserved
-- by the composite index from 0056, which is re-asserted here first so the guarantee is
-- never absent even for a moment (and in case 0056 was only partially applied). The
-- reconcile/upsert path already conflict-targets (curriculum_version_id, lesson_key), no
-- foreign key references curriculum_lesson.lesson_key (lesson_plans.curriculum_lesson_id
-- is a loose text column, 0003), and every read is version-scoped (base table pinned to
-- a curriculum_version_id, or the curriculum_lesson_active view) — so no app code changes.
--
-- PROVENANCE / HOW TO APPLY: applied by hand in the Supabase SQL editor like
-- 0010/0015/0024/0044/0047/0049/0050/0051/0053/0055/0056; committed idempotently so the
-- schema stays the locked source of truth and `supabase db reset` reproduces it. The
-- agent never executes SQL. Re-running is safe.

-- Re-assert the version-scoped composite uniqueness before removing the global one.
create unique index if not exists curriculum_lesson_version_lesson_key_uidx
  on public.curriculum_lesson (curriculum_version_id, lesson_key);

-- Drop the leftover global (lesson_key)-only unique index (from 0015) that 0056 missed.
drop index if exists public.curriculum_lesson_lesson_key_uidx;
