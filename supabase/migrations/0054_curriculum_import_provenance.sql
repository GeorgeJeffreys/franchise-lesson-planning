-- 0054_curriculum_import_provenance.sql
--
-- Persist import provenance so the per-subject Curriculum Gaps reconcile page can show
--   (a) the original spreadsheet row number each lesson was parsed from (`srow` in the
--       reconcile UI — the "Row" column, "Copy row N", and the CSV export), and
--   (b) the uploaded workbook's filename in the reconcile action bar.
--
-- The parser already computes both — `CurriculumRecord.sourceRow` (parse.ts) and the
-- upload `file.name` — but neither was carried onto the write shape or the run row, so
-- the reconcile page had no real source for them. Rather than fake or omit, we persist.
--
-- Both columns are ADDITIVE + NULLABLE: rows/runs imported before this migration read
-- back null (the reconcile page degrades gracefully — shows "—" and disables the
-- copy-locator affordance — until the next re-import), and the importer backfills them
-- on the next sync. No existing read path references either column.

alter table public.curriculum_lesson
  add column if not exists source_row int;

comment on column public.curriculum_lesson.source_row is
  '1-based row number in the source workbook sheet this lesson was parsed from. Null on rows imported before migration 0054 (populated on the next re-import). Surfaced by the Curriculum Gaps reconcile page.';

alter table public.curriculum_sync_run
  add column if not exists source_filename text;

comment on column public.curriculum_sync_run.source_filename is
  'Original filename of the uploaded/synced workbook, when known (null for older runs or sources that supply none). Shown in the Curriculum Gaps reconcile action bar.';
