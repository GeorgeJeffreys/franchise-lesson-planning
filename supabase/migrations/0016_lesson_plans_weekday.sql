-- 0016_lesson_plans_weekday.sql
-- The day-column weekly board places each plan in a (year, weekday) stack and
-- numbers it by its position in that stack. Two columns carry that placement:
--
--   • weekday — which Mon–Fri column the card sits in (1 = Mon … 5 = Fri).
--   • period  — REPURPOSED from "curriculum period" to the day-ordinal: the
--     card's 1-based position within its day's stack (top = 1). The displayed
--     "Period N" is re-derived from the sorted stack on the client, so this is a
--     sort hint, not an authoritative label. The curriculum period is still
--     recoverable from `curriculum_lesson_id` when needed.
--
-- NOTE: this migration is also applied by hand against the live database (George
-- applies SQL directly). It is written idempotently so a hand-applied column and
-- this file converge; `db reset` re-applies it cleanly.

alter table public.lesson_plans
  add column if not exists weekday int check (weekday between 1 and 5);

comment on column public.lesson_plans.weekday is
  'Day-of-week column on the weekly board (1=Mon..5=Fri). Null on legacy rows.';
comment on column public.lesson_plans.period is
  'Day-ordinal: 1-based position within its (year, weekday) stack. Was the curriculum period before 0016.';
