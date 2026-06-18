-- 0003_lesson_plans.sql
-- The lesson_plans table, its updated_at trigger, and indexes.

-- Maintains updated_at on every row update (ported from the old migration).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes,
  -- A curriculum.json key, e.g. '0.S1.K1.H3'. No FK: curriculum is a flat file.
  curriculum_lesson_id text not null,
  lesson_date date not null,
  period int,                                       -- 1..5, the day-of-week period
  status public.plan_status not null default 'in_progress',
  smartt_objective text,
  smartt_check jsonb,                               -- optional per-component validation result
  blocks jsonb not null default '[]'::jsonb,        -- ordered array of Block
  created_by uuid not null references public.profiles,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_note text,                                 -- coordinator note on return
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, lesson_date)
);

create trigger lesson_plans_set_updated_at
  before update on public.lesson_plans
  for each row
  execute function public.set_updated_at();

create index lesson_plans_class_id_idx on public.lesson_plans (class_id);
create index lesson_plans_created_by_idx on public.lesson_plans (created_by);
create index lesson_plans_status_idx on public.lesson_plans (status);
