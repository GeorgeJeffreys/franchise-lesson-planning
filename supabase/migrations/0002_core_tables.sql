-- 0002_core_tables.sql
-- Reference and identity tables: schools, subjects, classes, profiles, class_teachers.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools,
  subject_id uuid not null references public.subjects,
  year int not null check (year between 0 and 6),
  group_label text not null,
  literacy public.literacy not null default 'mixed',
  created_at timestamptz not null default now(),
  unique (school_id, subject_id, year, group_label)
);

-- Mirrors auth.users; a row is created automatically on sign-up by the
-- handle_new_user trigger (migration 0005).
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role public.user_role not null default 'teacher',
  school_id uuid references public.schools,
  subject_id uuid references public.subjects,
  created_at timestamptz not null default now()
);

create table public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes,
  teacher_id uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_id)
);
