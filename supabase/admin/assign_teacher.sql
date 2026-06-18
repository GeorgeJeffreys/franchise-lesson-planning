-- assign_teacher.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Provision a signed-in user as a real teacher so the next slice (Weekly
-- Overview) has data to show. It:
--   1. points the profile at the seeded English school + subject, and
--   2. assigns the teacher to every seeded class at that school.
--
-- This is an ADMIN script. Run it with the service-role connection (e.g. the
-- Supabase SQL editor, or psql against the DB) — it touches reference tables and
-- bypasses RLS. NEVER run this from a user request or with the anon key.
--
-- Prerequisite: the user must have signed in at least once, so the
-- handle_new_user trigger has created their profiles row.
--
-- ── Usage (psql) ───────────────────────────────────────────────────────────
--   By email:
--     psql "$DATABASE_URL" -v teacher_email="'teacher@example.org'" \
--       -f supabase/admin/assign_teacher.sql
--   By auth uid: edit the resolver below to use teacher_uid, then:
--     psql "$DATABASE_URL" -v teacher_uid="'00000000-0000-0000-0000-000000000000'" \
--       -f supabase/admin/assign_teacher.sql
--
-- ── Usage (Supabase SQL editor) ────────────────────────────────────────────
--   Replace :'teacher_email' below with a literal 'teacher@example.org' and run.
--   (The dashboard editor doesn't support psql -v variables.)
--
-- Find a uid: the authed landing page temporarily prints it, or use the
-- Supabase dashboard → Authentication → Users.
-- ───────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

begin;

-- Resolve the target profile. Default: by auth email.
-- To resolve by uid instead, comment the email line and uncomment the uid line.
create temporary table _target on commit drop as
select p.id as teacher_id
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower(:'teacher_email');
--  where p.id = :'teacher_uid';

-- Fail loudly if the user hasn't signed in yet (no profile row).
do $$
begin
  if (select count(*) from _target) = 0 then
    raise exception
      'No profile matched — has the user signed in at least once?';
  end if;
end $$;

-- 1) Point the profile at the seeded English school + subject.
update public.profiles p
set school_id = s.id,
    subject_id = sub.id
from _target t,
     public.schools s,
     public.subjects sub
where p.id = t.teacher_id
  and s.name = 'Shatila Centre'
  and sub.code = 'english';

-- 2) Assign the teacher to every seeded class at their school (idempotent).
insert into public.class_teachers (class_id, teacher_id)
select c.id, t.teacher_id
from _target t
join public.profiles p on p.id = t.teacher_id
join public.classes c on c.school_id = p.school_id
on conflict (class_id, teacher_id) do nothing;

commit;
