-- 0014_org_admin_columns.sql
--
-- Org-structure admin columns for the settings console (Centres · Subjects ·
-- Classes management). Adds the soft-archive marker `archived_at` to the three
-- reference tables and a `region` label to schools. Archiving is a soft delete:
-- a non-null `archived_at` removes the row from planning surfaces (the picker,
-- onboarding, the weekly overview) while preserving history (lesson plans keep
-- referencing an archived class). `region` is an optional grouping label on a
-- centre.
--
-- NOTE ON PROVENANCE: this DDL is also applied manually by an operator in the
-- Supabase SQL editor (George applies it to the live database). It is committed
-- here, idempotently, so the schema stays the locked source of truth in-repo and
-- a local `supabase db reset` reproduces it. Every statement is guarded with
-- IF NOT EXISTS, so re-running is safe.

alter table public.schools  add column if not exists region      text;
alter table public.schools  add column if not exists archived_at timestamptz;
alter table public.subjects add column if not exists archived_at timestamptz;
alter table public.classes  add column if not exists archived_at timestamptz;

-- Partial indexes to keep the "active rows only" reads (planning surfaces) cheap.
create index if not exists schools_active_idx  on public.schools  (id) where archived_at is null;
create index if not exists subjects_active_idx on public.subjects (id) where archived_at is null;
create index if not exists classes_active_idx  on public.classes  (id) where archived_at is null;
