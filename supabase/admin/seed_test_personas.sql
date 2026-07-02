-- seed_test_personas.sql
--
-- One dedicated TEACHER persona per coordinator-tester, so testers no longer
-- share a single "Test Teacher" (shared personas collide under per-teacher plan
-- ownership and don't scale to parallel testers).
--
-- Runs with the service-role connection (Supabase SQL editor or psql) and bypasses
-- RLS — never from a user request. Fully idempotent: re-running only ensures the
-- persona's profile flag + membership exist; it never renames or deletes anything.
--
-- ── DO NOT hand-write auth.users here ─────────────────────────────────────────
-- SQL-seeded auth users produced malformed identity/token rows last time (the
-- failure mode that killed the admin-API / generateLink approach). Instead:
--
--   1. In the Supabase dashboard → Authentication → Users, CREATE each persona
--      user with the persona email + the shared TEST_PERSONA_PASSWORD, and mark it
--      auto-confirmed. GoTrue then builds well-formed identity/token rows.
--   2. Fill the VALUES list below with those exact emails (+ a display name).
--   3. Run this file. It self-joins to auth.users BY EMAIL — no uid copying — to
--      create/flag the profile (role 'teacher', is_test_persona = true) and one
--      teacher subject_membership at the test centre (Shatila / English).
--
-- The tester's OWN account (the person logging in via Entra) gets can_impersonate
-- set separately and manually by George — it is NOT touched here.
--
-- Live IDs (confirm before running):
--   Shatila centre : 42c11721-c16b-4221-a945-473c028278b7
--   English subject: a1812346-77ca-45c1-8a94-33260fbb8729

-- ── persona list — GEORGE FILLS THIS ─────────────────────────────────────────
-- Add one row per tester persona: (email, display name). The email MUST match the
-- auth user created in step 1. Delete the REPLACE_ME placeholder once you add real
-- rows — as shipped it points at a non-existent address, so this file is a safe
-- no-op until you populate it (the joins below match nothing).
drop table if exists _persona_seed;
create temporary table _persona_seed (email text not null, full_name text);

insert into _persona_seed (email, full_name) values
  ('REPLACE_ME@example.invalid', 'Replace me')
  -- , ('layla.tester@your-domain.example', 'Layla (Tester)')
  -- , ('omar.tester@your-domain.example',  'Omar (Tester)')
;

-- Guard against the shipped placeholder ever matching a real user.
delete from _persona_seed where email ilike 'REPLACE_ME@example.invalid';

-- ── profiles: mark each persona as an impersonatable test teacher ────────────
-- The auth user's sign-up already inserted a profiles row (handle_new_user), so
-- this normally UPDATEs an existing row. role is hard-set to 'teacher'.
insert into public.profiles (id, full_name, role, is_test_persona)
select u.id, coalesce(ps.full_name, u.email), 'teacher', true
from _persona_seed ps
join auth.users u on lower(u.email) = lower(ps.email)
on conflict (id) do update
  set is_test_persona = true,
      role            = 'teacher',
      full_name       = coalesce(excluded.full_name, public.profiles.full_name);

-- ── subject_membership: one teacher membership at the test centre ────────────
insert into public.subject_membership (profile_id, school_id, subject_id, role)
select u.id,
       '42c11721-c16b-4221-a945-473c028278b7'::uuid,  -- Shatila centre (live)
       'a1812346-77ca-45c1-8a94-33260fbb8729'::uuid,  -- English subject (live)
       'teacher'
from _persona_seed ps
join auth.users u on lower(u.email) = lower(ps.email)
on conflict (profile_id, school_id, subject_id) do nothing;

drop table _persona_seed;
