-- verify_profile_email.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Verify the BRIDGE FOUNDATION after inviting a teacher: confirm the email
-- stored for their account EXACTLY equals the Alsama address they were invited
-- with. The future schedule matcher joins on this email, so it must be exact.
--
-- The canonical email lives in auth.users.email and is reached 1:1 from
-- public.profiles via profiles.id = auth.users.id (there is no profiles.email
-- column — handle_new_user is intentionally left unchanged). This query is the
-- same join assign_teacher.sql uses.
--
-- This is a read-only ADMIN query. Run it in the Supabase SQL editor (replace
-- the literal email below) or via psql against the DB.
-- ───────────────────────────────────────────────────────────────────────────

-- ↓ Replace with the exact Alsama email you invited.
select
  p.id,
  u.email                            as auth_email,
  (u.email = 'teacher@alsama.org')   as matches_exactly,
  p.full_name,
  p.role,
  u.confirmed_at,
  u.invited_at
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'teacher@alsama.org';

-- Expect: exactly one row, matches_exactly = true. That confirms a profiles row
-- exists whose (auth) email is precisely the Alsama sign-in address.
