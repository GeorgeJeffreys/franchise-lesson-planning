-- 0010_curriculum_lesson.sql
-- Curriculum moves off the committed curriculum.json onto a Supabase table fed
-- from the curriculum Excel, so edits propagate without a redeploy.
--
-- NOTE ON PROVENANCE: this DDL is also applied manually by an operator in the
-- Supabase SQL editor (see the curriculum-sync brief, "① SQL"). It is committed
-- here, idempotently, so the schema stays the locked source of truth in-repo and
-- a local `supabase db reset` reproduces it. Re-running is safe.
--
-- Natural key is (subject_code, year, month, week, period) — NOT the taxonomy id,
-- which the source spreadsheet leaves unreliable. lesson_key is the stable string
-- the picker writes into lesson_plans.curriculum_lesson_id (which stays `text`).

create table if not exists public.curriculum_lesson (
  id                   uuid primary key default gen_random_uuid(),
  subject_code         text not null,                 -- matches subjects.code (english, ...)
  year                 int  not null check (year between 0 and 6),
  month                text not null,                 -- 'February'
  week                 int  not null,
  period               int  not null check (period between 1 and 6),
  lesson_key           text not null,                 -- subject_code|Y{year}|{month}|W{week}|P{period}
  daily_outcome        text,
  focus_area           text,
  linguistic_skill     text,
  theme                text,
  resources            jsonb not null default '[]',   -- [{label, url}]; page refs are label-only
  taxonomy_id          text,                          -- best-effort, may be null
  monthly_knowledge_lo text,
  monthly_skills_lo    text,
  weekly_knowledge_lo  text,
  weekly_skills_lo     text,
  is_active            boolean not null default true,
  source               text not null default 'sharepoint',
  synced_at            timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  unique (subject_code, year, month, week, period),
  unique (lesson_key)
);
create index if not exists idx_curr_nav on public.curriculum_lesson (subject_code, year, month, week);

create table if not exists public.curriculum_sync_run (
  id            uuid primary key default gen_random_uuid(),
  subject_code  text,
  source        text,                                  -- 'n8n' | 'upload'
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  rows_upserted int, rows_deactivated int, unresolved int,
  status        text not null default 'running',       -- running|success|error
  error         text
);

-- RLS: curriculum is reference data — readable by any authenticated user; writes
-- go through the service role only (which bypasses RLS), so no write policy.
alter table public.curriculum_lesson enable row level security;
alter table public.curriculum_sync_run enable row level security;

drop policy if exists curr_read on public.curriculum_lesson;
create policy curr_read on public.curriculum_lesson for select
  using (auth.role() = 'authenticated');

drop policy if exists curr_run_read on public.curriculum_sync_run;
create policy curr_run_read on public.curriculum_sync_run for select
  using (auth.role() = 'authenticated');   -- members/admins read sync status in the console
