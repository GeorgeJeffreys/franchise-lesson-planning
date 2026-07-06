-- 0051_curriculum_topic_threads.sql
--
-- Backs the Explorer's TOPICS tab: Focus area → Topic → a spiral of the topic across
-- years. Returns ONE representative row per (focus_area, theme, year) for a subject,
-- plus that group's hour count — so the whole-subject read is a small GROUP BY result
-- (a few hundred rows at most), never a bulk table read the PostgREST 1000-row cap
-- could truncate.
--
-- GROUPING. `focus_area` TEXT is the Focus-Area tier for every subject EXCEPT english
-- (english has none); `theme` is the Topic tier. The app groups by focus_area where
-- present, else falls back to theme (english) — this function just surfaces both
-- columns and lets the caller pick. A row qualifies if it has EITHER a theme or a
-- focus area (so a subject with only one of the two still populates).
--
-- REPRESENTATIVE ROW. DISTINCT ON (focus_area, theme, year) keeps the earliest lesson
-- of each group (by week, then period) as the spiral card's daily outcome / resources /
-- lesson_key; the window COUNT over the same partition carries the group's total hours.
-- The spiral is presence/recurrence only — no depth/complexity column exists, so none
-- is derived here.
--
-- Security: SECURITY INVOKER (default, explicit) so `curr_read` RLS still governs; read
-- via the service-role client in practice. Grants mirror the 0050 aggregates.
--
-- PROVENANCE / HOW TO APPLY: applied by hand in the Supabase SQL editor like
-- 0010/0015/0024/0044/0047/0049/0050; committed idempotently (CREATE OR REPLACE) so the
-- schema stays the locked source of truth and `supabase db reset` reproduces it. The
-- agent never executes SQL. Re-running is safe.

create or replace function public.curriculum_topic_threads(p_subject text)
returns table (
  focus_area    text,
  theme         text,
  year          int,
  hours         bigint,
  lesson_key    text,
  daily_outcome text,
  strand_label  text,
  resources     jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (coalesce(s.fa, ''), coalesce(s.th, ''), s.yr)
    s.fa                                                                   as focus_area,
    s.th                                                                   as theme,
    s.yr                                                                   as year,
    count(*) over (partition by coalesce(s.fa, ''), coalesce(s.th, ''), s.yr) as hours,
    s.lk                                                                   as lesson_key,
    s.doo                                                                  as daily_outcome,
    s.sl                                                                   as strand_label,
    s.res                                                                  as resources
  from (
    select
      nullif(btrim(cl.focus_area), '')                                       as fa,
      nullif(btrim(cl.theme), '')                                            as th,
      cl.year                                                                as yr,
      cl.week                                                                as wk,
      cl.period                                                              as pd,
      cl.lesson_key                                                          as lk,
      cl.daily_outcome                                                       as doo,
      coalesce(nullif(btrim(cl.linguistic_skill), ''), nullif(btrim(cl.focus_area), '')) as sl,
      cl.resources                                                           as res
    from public.curriculum_lesson cl
    where cl.is_active
      and cl.subject_code = p_subject
      and (nullif(btrim(cl.theme), '') is not null or nullif(btrim(cl.focus_area), '') is not null)
  ) s
  order by coalesce(s.fa, ''), coalesce(s.th, ''), s.yr, s.wk nulls last, s.pd nulls last;
$$;

revoke execute on function public.curriculum_topic_threads(text) from public;
grant  execute on function public.curriculum_topic_threads(text) to authenticated, service_role;
