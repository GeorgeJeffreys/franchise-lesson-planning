-- 0008_resource_bank.sql
-- Resource bank data layer: shared teaching resources, a coordinator-managed
-- tag vocabulary, per-teacher folders, and usage tracking. Additive only —
-- activity_bank is untouched (it remains the source for CFU and Exit Ticket).
--
-- A private storage bucket 'resources' backs uploaded files; resources may also
-- point at an external URL instead. RLS is enabled on every new table.

-- ── tables ───────────────────────────────────────────────────────────────────

-- A shareable teaching resource: either an uploaded file (file_path, in the
-- 'resources' bucket) OR an external link (external_url) — exactly one of them.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject_id uuid references public.subjects (id),
  year int,
  file_path text,
  external_url text,
  uploaded_by uuid not null references auth.users (id) default auth.uid(),
  usage_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint resources_one_source check (
    (file_path is not null and external_url is null)
    or (file_path is null and external_url is not null)
  )
);

create index resources_subject_id_idx on public.resources (subject_id);
create index resources_uploaded_by_idx on public.resources (uploaded_by);

-- The coordinator-managed tag vocabulary. Each tag lives in one dimension; a
-- subject_id scopes subject-specific tags (e.g. skill_type for English) and is
-- null for global dimensions.
create table public.resource_tags (
  id uuid primary key default gen_random_uuid(),
  dimension text not null check (
    dimension in (
      'theme',
      'format',
      'exercise_type',
      'lesson_stage',
      'skill_type',
      'grammar_content',
      'localisation'
    )
  ),
  label text not null,
  subject_id uuid references public.subjects (id),
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (dimension, label, subject_id)
);

create index resource_tags_dimension_idx on public.resource_tags (dimension);

-- Many-to-many: which tags are attached to which resource.
create table public.resource_tag_links (
  resource_id uuid references public.resources (id) on delete cascade,
  tag_id uuid references public.resource_tags (id) on delete cascade,
  primary key (resource_id, tag_id)
);

create index resource_tag_links_tag_id_idx on public.resource_tag_links (tag_id);

-- A teacher's personal folder for organising resources.
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) default auth.uid(),
  name text not null,
  created_at timestamptz default now()
);

create index folders_owner_id_idx on public.folders (owner_id);

-- Which resources sit in which folder.
create table public.folder_resources (
  folder_id uuid references public.folders (id) on delete cascade,
  resource_id uuid references public.resources (id) on delete cascade,
  added_at timestamptz default now(),
  primary key (folder_id, resource_id)
);

create index folder_resources_resource_id_idx on public.folder_resources (resource_id);

-- A single use of a resource by a teacher, optionally tied to a lesson plan.
-- Popularity is the aggregate usage_count on resources; per-teacher "Most used"
-- is a query over this table by used_by.
create table public.resource_usage (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references public.resources (id) on delete cascade,
  used_by uuid not null references auth.users (id) default auth.uid(),
  lesson_plan_id uuid references public.lesson_plans (id),
  used_at timestamptz default now()
);

create index resource_usage_resource_id_idx on public.resource_usage (resource_id);
create index resource_usage_used_by_idx on public.resource_usage (used_by);

-- ── usage_count trigger ──────────────────────────────────────────────────────
-- Each recorded use bumps the resource's denormalised usage_count.
create or replace function public.bump_resource_usage_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.resources
    set usage_count = usage_count + 1
    where id = new.resource_id;
  return new;
end;
$$;

create trigger resource_usage_bump_count
  after insert on public.resource_usage
  for each row
  execute function public.bump_resource_usage_count();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.resources          enable row level security;
alter table public.resource_tags      enable row level security;
alter table public.resource_tag_links enable row level security;
alter table public.folders            enable row level security;
alter table public.folder_resources   enable row level security;
alter table public.resource_usage     enable row level security;

-- resources: readable by any authenticated user; a user inserts only rows they
-- own; the owner or any coordinator may update/delete.
create policy "resources_select_authenticated"
  on public.resources for select to authenticated
  using (true);

create policy "resources_insert_own"
  on public.resources for insert to authenticated
  with check (uploaded_by = (select auth.uid()));

create policy "resources_update_own_or_coordinator"
  on public.resources for update to authenticated
  using (
    uploaded_by = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  )
  with check (
    uploaded_by = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

create policy "resources_delete_own_or_coordinator"
  on public.resources for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

-- resource_tags: readable by any authenticated user; coordinator-only writes.
create policy "resource_tags_select_authenticated"
  on public.resource_tags for select to authenticated
  using (true);

create policy "resource_tags_insert_coordinator"
  on public.resource_tags for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

create policy "resource_tags_update_coordinator"
  on public.resource_tags for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

create policy "resource_tags_delete_coordinator"
  on public.resource_tags for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'coordinator'
    )
  );

-- resource_tag_links: readable by any authenticated user; a user may link/unlink
-- tags only on a resource they may edit (own it, or coordinator).
create policy "resource_tag_links_select_authenticated"
  on public.resource_tag_links for select to authenticated
  using (true);

create policy "resource_tag_links_insert_editable_resource"
  on public.resource_tag_links for insert to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_tag_links.resource_id
        and (
          r.uploaded_by = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'coordinator'
          )
        )
    )
  );

create policy "resource_tag_links_delete_editable_resource"
  on public.resource_tag_links for delete to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_tag_links.resource_id
        and (
          r.uploaded_by = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'coordinator'
          )
        )
    )
  );

-- folders: every action restricted to the owner.
create policy "folders_select_own"
  on public.folders for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "folders_insert_own"
  on public.folders for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "folders_update_own"
  on public.folders for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "folders_delete_own"
  on public.folders for delete to authenticated
  using (owner_id = (select auth.uid()));

-- folder_resources: scoped via the parent folder's owner.
create policy "folder_resources_select_owner"
  on public.folder_resources for select to authenticated
  using (
    exists (
      select 1 from public.folders f
      where f.id = folder_resources.folder_id
        and f.owner_id = (select auth.uid())
    )
  );

create policy "folder_resources_insert_owner"
  on public.folder_resources for insert to authenticated
  with check (
    exists (
      select 1 from public.folders f
      where f.id = folder_resources.folder_id
        and f.owner_id = (select auth.uid())
    )
  );

create policy "folder_resources_delete_owner"
  on public.folder_resources for delete to authenticated
  using (
    exists (
      select 1 from public.folders f
      where f.id = folder_resources.folder_id
        and f.owner_id = (select auth.uid())
    )
  );

-- resource_usage: a user inserts only their own rows and reads only their own.
create policy "resource_usage_insert_own"
  on public.resource_usage for insert to authenticated
  with check (used_by = (select auth.uid()));

create policy "resource_usage_select_own"
  on public.resource_usage for select to authenticated
  using (used_by = (select auth.uid()));

-- ── storage: private 'resources' bucket ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

-- Any authenticated user may read objects in the bucket; a user may upload only
-- objects they own; the owner or a coordinator may update/delete.
create policy "resources_storage_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'resources');

create policy "resources_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and owner = (select auth.uid()));

create policy "resources_storage_update_own_or_coordinator"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resources'
    and (
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  )
  with check (
    bucket_id = 'resources'
    and (
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  );

create policy "resources_storage_delete_own_or_coordinator"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resources'
    and (
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'coordinator'
      )
    )
  );

-- ── seed: starter tag vocabulary ─────────────────────────────────────────────
-- Coordinators extend these later. theme and grammar_content start empty.
-- skill_type tags are scoped to the English subject row.

insert into public.resource_tags (dimension, label, subject_id, sort_order)
values
  ('lesson_stage', 'Warm-up',                  null, 1),
  ('lesson_stage', 'Recap',                     null, 2),
  ('lesson_stage', 'New content',               null, 3),
  ('lesson_stage', 'Check for understanding',   null, 4),
  ('lesson_stage', 'Independent work',          null, 5),
  ('lesson_stage', 'Group work',                null, 6),
  ('lesson_stage', 'Exit ticket',               null, 7),
  ('lesson_stage', 'Homework',                  null, 8),
  ('exercise_type', 'gap fill',                 null, 1),
  ('exercise_type', 'matching',                 null, 2),
  ('exercise_type', 'multiple choice',          null, 3),
  ('exercise_type', 'dialogue/role-play',       null, 4),
  ('exercise_type', 'free writing',             null, 5),
  ('exercise_type', 'reading comprehension',    null, 6),
  ('exercise_type', 'flashcards',               null, 7),
  ('exercise_type', 'sorting',                  null, 8),
  ('exercise_type', 'true/false',               null, 9),
  ('exercise_type', 'labelling',                null, 10),
  ('localisation', 'Lebanon',                   null, 1),
  ('localisation', 'Syria',                     null, 2),
  ('localisation', 'Both',                      null, 3),
  ('localisation', 'General',                   null, 4),
  ('format', 'PDF',                             null, 1),
  ('format', 'Word doc',                        null, 2),
  ('format', 'Image',                           null, 3),
  ('format', 'Link',                            null, 4),
  ('format', 'Audio',                           null, 5),
  ('format', 'Video',                           null, 6),
  ('format', 'Worksheet',                       null, 7)
on conflict (dimension, label, subject_id) do nothing;

insert into public.resource_tags (dimension, label, subject_id, sort_order)
select 'skill_type', label, (select id from public.subjects where code = 'english'), sort_order
from (values
  ('Reading', 1),
  ('Writing', 2),
  ('Listening', 3),
  ('Speaking', 4),
  ('Basic Literacy', 5)
) as t(label, sort_order)
where exists (select 1 from public.subjects where code = 'english')
on conflict (dimension, label, subject_id) do nothing;
