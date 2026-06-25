-- 0016_ai_resource_guide.sql
-- Storage for the admin-uploaded "best-practice guide" that steers the AI
-- resource generator (Aya). The guide is the middle of a three-part composed
-- system prompt: [hardcoded role + org framing] → [this uploaded guide] →
-- [hardcoded SAFETY FLOOR + JSON output contract]. The floor and contract stay
-- in code so a bad/empty upload can never strip them; the guide adds the rich
-- steering in between.
--
-- The guide is text in a row (not a Storage file) because it is read on every
-- generate call. Each upload INSERTS a new row; the latest created_at is the
-- active version. Rows are immutable — there is no update/delete policy — so the
-- table is a full version history with trivial rollback (upload an older text).
--
-- NOTE ON PROVENANCE: like 0010/0014/0015, this DDL is also applied by hand in
-- the Supabase SQL editor by the operator (George applies it to the live
-- database). It is committed here, idempotently, so the schema stays the locked
-- source of truth in-repo and a local `supabase db reset` reproduces it. Every
-- statement is guarded, so re-running is safe.

create table if not exists public.ai_resource_guide (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  uploaded_by uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

-- Active-version lookup is "latest created_at"; index it for the read path.
create index if not exists ai_resource_guide_created_at_idx
  on public.ai_resource_guide (created_at desc);

-- ── RLS: admin-only insert + select; rows are immutable (no update/delete) ────
-- Direct table access is admin-only: admins read the full version history for the
-- Settings preview, and only admins upload new versions. Non-admins never touch
-- the table directly — the generator reads the active guide through the
-- security-definer function below, which exposes ONLY the latest content (not the
-- history) to any authenticated caller.
alter table public.ai_resource_guide enable row level security;

drop policy if exists ai_resource_guide_select_admin on public.ai_resource_guide;
create policy ai_resource_guide_select_admin
  on public.ai_resource_guide for select to authenticated
  using (public.is_admin());

drop policy if exists ai_resource_guide_insert_admin on public.ai_resource_guide;
create policy ai_resource_guide_insert_admin
  on public.ai_resource_guide for insert to authenticated
  with check (public.is_admin() and uploaded_by = (select auth.uid()));

-- ── active-guide read for the generator ──────────────────────────────────────
-- The generate-resource path runs in teachers' user requests, which must NOT use
-- the service-role key (it bypasses RLS — forbidden in user-facing requests, see
-- CLAUDE.md). Direct SELECT is admin-only, so teachers would otherwise always
-- fall back to the hardcoded default. This security-definer function returns just
-- the active guide's content text to any authenticated caller — the steering text
-- is operational, not sensitive, while the version history stays admin-only.
-- Mirrors the is_admin() helper pattern (stable, security definer, fixed
-- search_path). Returns NULL when no guide has been uploaded; the TS helper then
-- substitutes the hardcoded default.
create or replace function public.get_active_resource_guide()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select content
  from public.ai_resource_guide
  order by created_at desc
  limit 1;
$$;

grant execute on function public.get_active_resource_guide() to authenticated;
