-- 0039_reconciliation_counts.sql — READ-ONLY. Run in the Supabase SQL editor.
--
-- These queries size the migration-2 backfill against live data. None of them
-- write anything. Paste the results back and migration 2 (the backfill) will be
-- authored to match. Run all six; each prints one number (Q5 prints a small list).
--
-- Context: the role-first model represents each user as exactly one of admin /
-- teacher / coordinator. Q1–Q4 quantify existing data that this single-role,
-- all-schools model cannot represent verbatim; Q5 lists the coordinator rows to
-- move into coordinator_subject; Q6 sanity-checks that the new table is empty
-- before backfill.

-- Q1 — Mixed membership roles: users who hold BOTH a teacher and a coordinator
-- subject_membership row. The single-role model collapses them to "coordinator".
select count(*) as mixed_role_users
from (
  select profile_id
  from public.subject_membership
  group by profile_id
  having count(*) filter (where role = 'teacher') > 0
     and count(*) filter (where role = 'coordinator') > 0
) x;

-- Q2 — Partial coordinators: (person, subject) pairs coordinated at only SOME of
-- the active schools. Under "coordinator = all schools" this is unrepresentable as
-- a partial state; the backfill promotes them to all-schools (documented per case).
with active as (
  select count(*) as n from public.schools where archived_at is null
)
select count(*) as partial_coordinators
from (
  select sm.profile_id, sm.subject_id, count(distinct sm.school_id) as coord_schools
  from public.subject_membership sm
  where sm.role = 'coordinator'
  group by sm.profile_id, sm.subject_id
) c
cross join active
where c.coord_schools < active.n;

-- Q3 — Admins holding membership rows: the settled model says admin ⇒ no
-- subject_membership and no coordinator_subject rows. (The current UI never cleared
-- these on promote, so some may exist.) Migration 2 strips them.
select count(distinct sm.profile_id) as admins_with_membership_rows
from public.subject_membership sm
join public.profiles p on p.id = sm.profile_id
where p.role = 'admin';

-- Q4 — Non-cartesian teachers: teachers whose (school × subject) rows are NOT the
-- full cartesian of their distinct schools and subjects (e.g. English@A + Math@B
-- but not the cross pairs). Not migrated proactively; over-granting only happens on
-- a deliberate re-save in the modal. This is informational — a high count means we
-- revisit the accept-cartesian-expansion decision.
select count(*) as non_cartesian_teachers
from (
  select profile_id
  from public.subject_membership
  where role = 'teacher'
  group by profile_id
  having count(*) <> count(distinct school_id) * count(distinct subject_id)
) x;

-- Q5 — Coordinator rows to migrate: the distinct (person, subject) pairs currently
-- carrying a coordinator subject_membership row, with how many schools each spans.
-- This is exactly what migration 2 inserts into coordinator_subject (one row per
-- pair) before deleting the legacy rows.
select
  sm.profile_id,
  sm.subject_id,
  subj.name                     as subject,
  count(distinct sm.school_id)  as school_count
from public.subject_membership sm
join public.subjects subj on subj.id = sm.subject_id
where sm.role = 'coordinator'
group by sm.profile_id, sm.subject_id, subj.name
order by subj.name, sm.profile_id;

-- Q6 — Sanity: coordinator_subject should be empty before the backfill (migration 1
-- only creates the table). A non-zero here means a prior partial run — reconcile
-- before applying migration 2.
select count(*) as existing_coordinator_subject_rows
from public.coordinator_subject;
