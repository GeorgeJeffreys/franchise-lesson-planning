-- 0055_curriculum_hours_by_linguistic_skill.sql
--
-- Backs the Insights "Hours per linguistic skill" card — the ENGLISH fallback for the
-- "Hours per focus area" analytic. English carries no `focus_area` text (so grouping by
-- focus area is impossible) and has ~178 themes (so grouping by theme is an unbounded
-- list). The meaningful, bounded lens for English is instead its handful of linguistic
-- skills (Listening / Reading / Speaking / Writing / Basic Literacy), so this function
-- returns the taught-hour count per raw `linguistic_skill` value for a subject.
--
-- CANONICALISATION happens in the app (src/lib/curriculum/insights.ts, `hoursByLinguisticSkill`)
-- — the raw source labels vary in casing/spelling and carry non-skill junk ("Teachers
-- Choice", single-letter placeholders), so the DB returns the raw grouped counts and the
-- pure, unit-tested TS layer folds variants into the ~5 canonical skills and drops junk.
--
-- Like the 0050/0051 aggregates this SCANS a whole subject (English ~1190 active rows)
-- but RETURNS a small GROUP BY result, so the PostgREST 1000-row cap can never truncate
-- it — the reason this is a function, not a client-side reduction over a bulk select.
--
-- Security: SECURITY INVOKER (the default, stated explicitly) so `curr_read` RLS still
-- governs; read via the service-role client in practice (reference data, identical for
-- every user). Grants mirror the 0050/0051 aggregates.
--
-- PROVENANCE / HOW TO APPLY: applied by hand in the Supabase SQL editor like
-- 0010/0015/0024/0044/0047/0049/0050/0051; committed idempotently (CREATE OR REPLACE) so
-- the schema stays the locked source of truth and `supabase db reset` reproduces it. The
-- agent never executes SQL. Re-running is safe.

create or replace function public.curriculum_hours_by_linguistic_skill(p_subject text)
returns table (linguistic_skill text, hours bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select nullif(btrim(cl.linguistic_skill), '') as linguistic_skill, count(*)::bigint as hours
  from public.curriculum_lesson cl
  where cl.is_active
    and cl.subject_code = p_subject
    and nullif(btrim(cl.linguistic_skill), '') is not null
  group by nullif(btrim(cl.linguistic_skill), '');
$$;

revoke execute on function public.curriculum_hours_by_linguistic_skill(text) from public;
grant  execute on function public.curriculum_hours_by_linguistic_skill(text) to authenticated, service_role;
