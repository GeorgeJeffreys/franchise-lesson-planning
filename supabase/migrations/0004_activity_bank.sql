-- 0004_activity_bank.sql
-- Pre-approved activities a teacher can drop into a block.

create table public.activity_bank (
  id uuid primary key default gen_random_uuid(),
  block_type public.lesson_block not null,   -- which block this activity belongs to
  name text not null,
  summary text,                              -- short description of the technique
  literate_instructions text,
  illiterate_instructions text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index activity_bank_block_type_idx on public.activity_bank (block_type);
