-- 0062_term_calendar_school_year.sql
--
-- Term calendar: scope each term to a set of schools and a set of curriculum years.
--
-- WHY
--   0026 shipped ONE org-wide calendar. Two problems:
--     1. Four Beirut centres + Homs share one set of terms -- a date change is a 5x edit.
--     2. Year 0 is February-anchored (curriculum weeks 1-20); Y1-6 are September-anchored
--        (weeks 1-38+). A single week_no sequence cannot serve both.
--   Both dissolve if a term carries a set of schools and a set of years, and week_no
--   restarts per (school, year). Y0's start then IS its own term's starts_on -- no
--   per-year offset column, no hardcoded anchor month anywhere in the system.
--
-- BEFORE APPLYING
--   1. Confirm this is the next free migration number (0059 was the last one seen).
--   2. Confirm the term_week definition in section 4 matches 0026's ACTUAL column set
--      (names + types). It is reconstructed from an audit report, not read from source.
--      In particular: 0026 exposes BOTH starts_on and week_commencing, and both are
--      believed to be the week's Monday. If 0026's starts_on is the TERM's start rather
--      than the week's, STOP -- section 4 would change semantics and break
--      resolveCurrentTermWeekNo (src/lib/term-week.ts), which matches starts_on == Monday.
--
-- AFTER APPLYING -- two behaviour changes, read both
--   A. A term with no school links OR no year links produces ZERO weeks in term_week.
--      The current admin Term Calendar tab cannot set those links yet, so a term created
--      there yields no weeks until the UI ships (or links are inserted by hand).
--      term_week is currently empty/unseeded, so this is not a regression -- but do not
--      expect a newly created term to produce weeks yet.
--   B. The resolvers in src/lib/term-week.ts (resolveTermWeek, resolveCurrentTermWeekNo,
--      resolveNearestTermWeekNo) query term_week WITHOUT a (school, year) filter. Once
--      terms are seeded, the view returns one row per week_no PER (school, year), so those
--      resolvers become ambiguous. They must take (school_id, year) BEFORE seeding matters.
--      Sequence: apply this -> ship UI + resolver rewire -> then seed.
--
-- NOT INCLUDED (deliberate)
--   Overlap guard: two terms covering the same (school, year) on overlapping dates is a
--   data error that row_number() will silently swallow. Enforcing it in SQL needs a
--   cross-table trigger (the date lives in term, the scope in the junctions), so an
--   EXCLUDE constraint won't reach it. Prevented in the admin UI instead; a detection
--   query ships alongside this migration. Revisit if the UI proves insufficient.

begin;

-- ---------------------------------------------------------------------------
-- 1. Junction: which schools a term applies to
-- ---------------------------------------------------------------------------
create table public.term_school (
  term_id    uuid        not null references public.term(id)    on delete cascade,
  school_id  uuid        not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (term_id, school_id)
);

-- PK is (term_id, school_id); reverse lookup by school needs its own index.
create index term_school_school_id_idx on public.term_school (school_id);

comment on table public.term_school is
  'Schools a term applies to. A term with no rows here produces no weeks in term_week.';

-- ---------------------------------------------------------------------------
-- 2. Junction: which curriculum years a term applies to
-- ---------------------------------------------------------------------------
create table public.term_year (
  term_id    uuid        not null references public.term(id) on delete cascade,
  year       smallint    not null check (year between 0 and 6),
  created_at timestamptz not null default now(),
  primary key (term_id, year)
);

create index term_year_year_idx on public.term_year (year);

comment on table public.term_year is
  'Curriculum years (0-6) a term applies to. A term with no rows here produces no weeks in term_week.';

-- ---------------------------------------------------------------------------
-- 3. RLS -- mirrors 0026: all authenticated read, admin-only write
-- ---------------------------------------------------------------------------
alter table public.term_school enable row level security;
alter table public.term_year   enable row level security;

create policy term_school_read on public.term_school
  for select to authenticated
  using (true);

create policy term_school_write on public.term_school
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy term_year_read on public.term_year
  for select to authenticated
  using (true);

create policy term_year_write on public.term_year
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grants are broad; RLS above is what actually gates writes to admins.
grant select, insert, update, delete on public.term_school to authenticated;
grant select, insert, update, delete on public.term_year   to authenticated;

-- ---------------------------------------------------------------------------
-- 4. term_week -- now derived per (school, year)
--
-- week_no restarts per (school, year). This partition is the load-bearing change:
-- without it, Shatila's terms interleave with Homs's and with Y0's into one
-- meaningless sequence.
--
-- Preserved from 0026:
--   * contiguous 1..N across holiday gaps (row_number continues; only dates jump)
--   * week_commencing is the real Monday (term.starts_on is CHECK isodow = 1)
--   * security_invoker -- defers to the term/term_school/term_year read policies
--   * starts_on and week_commencing are the same value; both kept for compatibility
--
-- DROP is deliberate and un-CASCADEd: CREATE OR REPLACE VIEW cannot reorder or insert
-- columns, and a dependent object should make this fail loudly rather than vanish.
-- ---------------------------------------------------------------------------
drop view if exists public.term_week;

create view public.term_week
  with (security_invoker = true)
as
select
  ts.school_id,
  ty.year,
  (row_number() over (
     partition by ts.school_id, ty.year
     order by t.starts_on, t.id, wk.week_number
   ))::int                                       as week_no,
  t.id                                           as term_id,
  wk.week_number,
  (t.starts_on + (wk.week_number - 1) * 7)::date as starts_on,
  (t.starts_on + (wk.week_number - 1) * 7)::date as week_commencing
from public.term t
join public.term_school ts on ts.term_id = t.id
join public.term_year   ty on ty.term_id = t.id
cross join lateral generate_series(1, t.num_weeks) as wk(week_number);

-- Recreating the view drops its grants -- restore.
grant select on public.term_week to authenticated;

comment on view public.term_week is
  'Teaching weeks derived from term x term_school x term_year. week_no is contiguous 1..N per (school_id, year) across holiday gaps; week_commencing is the real Monday.';

commit;

-- ---------------------------------------------------------------------------
-- OPTIONAL BACKFILL -- only if terms were already seeded before this migration.
--
-- Existing terms have no school/year links, so they now produce zero weeks. If (and
-- only if) the seeded terms were intended to apply to every school and years 1-6,
-- uncomment and run. Y0 is EXCLUDED deliberately -- it needs its own February-starting
-- term, not a September one.
--
-- Verify with the orphaned-terms query first. Do not run blind.
-- ---------------------------------------------------------------------------
-- insert into public.term_school (term_id, school_id)
-- select t.id, s.id from public.term t cross join public.schools s
-- on conflict do nothing;
--
-- insert into public.term_year (term_id, year)
-- select t.id, y from public.term t cross join generate_series(1, 6) as y
-- on conflict do nothing;
