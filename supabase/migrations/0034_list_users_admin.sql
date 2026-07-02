-- 0034_list_users_admin.sql
--
-- Global user administration, part 3 of 4: the READ source for the admin Users
-- tab. Requires 0032 (user_deactivation / is_deactivated) and the schema helpers.
--
-- One row per user with everything the Users tab renders: display name, email
-- (`auth.users.email` — only a definer can read it), admin flag, deactivation
-- flag, and the user's subject spaces as jsonb chips. This is a SEPARATE function
-- from the existing `admin_list_users()` (0023, used by the per-space Members
-- tab): the Users tab is the global, org-wide view and needs the admin/deactivated
-- flags that the Members list does not.
--
-- Security: reads OTHER users' emails, so it is hard-gated on `is_admin()`
-- (raises for non-admins — and, post-0033, for a deactivated admin too). Follows
-- the tightened cross-user-PII convention of admin_list_users: security definer,
-- STABLE, pinned `set search_path = public`, `revoke execute from public` +
-- `grant execute to authenticated`.
--
-- CC never applies migrations — George runs this in the Supabase SQL editor.
-- Idempotent (CREATE OR REPLACE): safe to re-run.

create or replace function public.list_users_admin()
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  is_admin       boolean,
  is_deactivated boolean,
  spaces         jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Hard admin gate: a non-admin must never read cross-user identity. Raise
  -- (privilege-not-granted) rather than silently return empty, so the caller can
  -- distinguish "not authorized" from "no users".
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    u.id                                   as user_id,
    p.full_name                            as full_name,
    u.email::text                          as email,
    coalesce(p.role = 'admin', false)      as is_admin,
    exists (
      select 1 from public.user_deactivation ud
      where ud.user_id = u.id
    )                                      as is_deactivated,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'subject', subj.name,
                   'role',    sm.role,
                   'centre',  s.name
                 )
                 order by subj.name, s.name
               )
        from public.subject_membership sm
        join public.subjects subj on subj.id = sm.subject_id
        join public.schools  s    on s.id    = sm.school_id
        where sm.profile_id = u.id
      ),
      '[]'::jsonb
    )                                      as spaces
  from auth.users u
  -- LEFT JOIN: a user normally has a profiles row (handle_new_user), but never
  -- drop a user from the list just because their profile is missing.
  left join public.profiles p on p.id = u.id
  order by p.full_name nulls last, u.email;
end;
$$;

revoke execute on function public.list_users_admin() from public;
grant  execute on function public.list_users_admin() to authenticated;
