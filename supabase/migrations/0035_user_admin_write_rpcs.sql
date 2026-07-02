-- 0035_user_admin_write_rpcs.sql
--
-- Global user administration, part 4 of 4: the admin WRITE RPCs behind the Users
-- tab. ⚠️ CORE AUTH. Requires 0032 (user_deactivation) and the 0033 helpers.
--
-- Both are SECURITY DEFINER, pinned `set search_path = public`, top-gated on
-- `is_admin()`, and granted to `authenticated` (revoked from public). `profiles`
-- is locked to own-row client writes, and `user_deactivation` has no client-write
-- policy at all — so these definer RPCs are the ONLY path that can flip a user's
-- admin bit or deactivation status. Each guard RAISES (never silently no-ops) so
-- the server action can surface the real message.
--
-- "Last active admin" is the load-bearing invariant: exactly the set of users
-- with `profiles.role = 'admin'` and NO active `user_deactivation` row. Both RPCs
-- refuse any action that would empty that set, so the org can never be locked out.
--
-- Non-admin default role: `user_role` (0001) is ('teacher','coordinator') with
-- 'admin' added in 0012; `profiles.role` DEFAULT is 'teacher' (0002). Coordinator
-- is now a per-space membership, not a global role — so the global non-admin
-- default is 'teacher'. Demotion therefore sets 'teacher'.
--
-- CC never applies migrations — George runs this in the Supabase SQL editor.
-- Idempotent (CREATE OR REPLACE): safe to re-run.

-- ── set_user_admin(p_user_id, p_make_admin) ───────────────────────────────────
create or replace function public.set_user_admin(
  p_user_id    uuid,
  p_make_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_admins int;
  v_target_active_admin boolean;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found';
  end if;

  if p_make_admin then
    -- Promote. Idempotent: re-promoting an admin is a harmless no-op.
    update public.profiles set role = 'admin' where id = p_user_id;
  else
    -- Demote → 'teacher' (the non-admin default). Refuse to remove the last
    -- active admin, or the org would have no one who can administer it.
    select
      count(*),
      bool_or(pr.id = p_user_id)
      into v_active_admins, v_target_active_admin
    from public.profiles pr
    where pr.role = 'admin'
      and not exists (
        select 1 from public.user_deactivation ud where ud.user_id = pr.id
      );

    if coalesce(v_target_active_admin, false) and coalesce(v_active_admins, 0) <= 1 then
      raise exception
        'This is the last active admin. Promote another admin before removing this one.';
    end if;

    update public.profiles set role = 'teacher' where id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.set_user_admin(uuid, boolean) from public;
grant  execute on function public.set_user_admin(uuid, boolean) to authenticated;

-- ── set_user_deactivated(p_user_id, p_deactivated) ────────────────────────────
-- Deactivate → upsert a user_deactivation row (recording the acting admin) AND
-- revoke every session so the user is signed out on all devices. Reactivate →
-- delete the row (access is restored losslessly; memberships were never touched).
--
-- SIGNED OUT ON EVERY DEVICE. auth-js 2.108's admin API has NO by-user-id global
-- logout (`auth.admin.signOut` needs the user's own JWT; only `deleteUser` takes
-- an id, and that is destructive), and the `auth` schema is not exposed through
-- PostgREST — so a service-role JS call cannot revoke another user's sessions.
-- This RPC runs as its owner (postgres, which owns the auth schema), so it deletes
-- the user's `auth.sessions` rows directly and atomically with the deactivation.
-- That, plus the 0033 helper predicate + the self-provision guard + the app's
-- front-door block, is what makes "loses access immediately, signed out on every
-- device" true. (Residual: an already-issued access JWT stays valid until it
-- expires ~1h, an accepted API-level residual; the front-door block covers the UX
-- immediately.)
create or replace function public.set_user_deactivated(
  p_user_id     uuid,
  p_deactivated boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_admins int;
  v_target_active_admin boolean;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found';
  end if;

  if p_deactivated then
    -- No self-deactivate: an admin cannot lock themselves out mid-action.
    if p_user_id = auth.uid() then
      raise exception 'You cannot deactivate your own account.';
    end if;

    -- Refuse to deactivate the last active admin.
    select
      count(*),
      bool_or(pr.id = p_user_id)
      into v_active_admins, v_target_active_admin
    from public.profiles pr
    where pr.role = 'admin'
      and not exists (
        select 1 from public.user_deactivation ud where ud.user_id = pr.id
      );

    if coalesce(v_target_active_admin, false) and coalesce(v_active_admins, 0) <= 1 then
      raise exception
        'This is the last active admin. Promote another admin before deactivating this one.';
    end if;

    insert into public.user_deactivation (user_id, deactivated_at, deactivated_by)
    values (p_user_id, now(), auth.uid())
    on conflict (user_id)
      do update set deactivated_at = excluded.deactivated_at,
                    deactivated_by = excluded.deactivated_by;

    -- Signed out on every device: drop all sessions for the user.
    delete from auth.sessions where user_id = p_user_id;
  else
    -- Reactivate: remove the deactivation row. Access + memberships return exactly
    -- as they were. (Self is never deactivated, so no self-guard needed here.)
    delete from public.user_deactivation where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.set_user_deactivated(uuid, boolean) from public;
grant  execute on function public.set_user_deactivated(uuid, boolean) to authenticated;
