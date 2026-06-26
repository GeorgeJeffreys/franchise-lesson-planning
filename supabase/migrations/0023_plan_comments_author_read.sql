-- 0023_plan_comments_author_read.sql
--
-- Teacher-facing reveal of coordinator review comments. This is the LATER slice the
-- 0022 migration deferred: the plan's AUTHOR (the teacher who wrote it) may now READ
-- the comments on their own plan, closing the return-for-changes loop.
--
-- Read-only on the teacher side: this grants SELECT only. No INSERT / UPDATE / DELETE
-- for authors — two-way reply threads are a separate, later slice. The existing
-- coordinator/admin policies (plan_comments_coord_select / _coord_insert) and the
-- is_coordinator_of_plan helper from 0022 are NOT touched; this adds a new permissive
-- SELECT policy ALONGSIDE them (Postgres ORs permissive policies, so coordinators keep
-- their access and authors gain theirs).
--
-- The author check is inlined as an EXISTS subselect against lesson_plans — matching
-- the form of 0022's INSERT policy rather than routing through a helper — so the
-- author path stays self-evident and independent of the coordinator helper. `created_by`
-- and `(select auth.uid())` come straight from the lesson_plans authorship column.
--
-- NOTE ON PROVENANCE: like the other numbered migrations, this DDL is also applied by
-- hand in the Supabase SQL editor (George applies it to the live database). It is
-- committed here, idempotently, so the schema stays the locked source of truth in-repo
-- and a local `supabase db reset` reproduces it.

-- ── RLS: author read (new, alongside the coordinator policies) ───────────────
drop policy if exists plan_comments_author_select on public.plan_comments;
create policy plan_comments_author_select
  on public.plan_comments for select to authenticated
  using (
    exists (
      select 1
      from public.lesson_plans lp
      where lp.id = plan_comments.plan_id
        and lp.created_by = (select auth.uid())
    )
  );
