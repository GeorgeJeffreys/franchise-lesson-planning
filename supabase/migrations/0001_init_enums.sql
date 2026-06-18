-- 0001_init_enums.sql
-- Extensions and enum types. The schema (these migrations) is the locked source
-- of truth for the app.

create extension if not exists pgcrypto;  -- gen_random_uuid()

create type public.user_role as enum ('teacher', 'coordinator');

-- 'needs_review' = a coordinator returned the plan to the teacher for edits.
-- "not started" is represented by the absence of a lesson_plans row.
create type public.plan_status as enum ('in_progress', 'submitted', 'needs_review', 'approved');

create type public.teaching_phase as enum ('i_do', 'we_do', 'you_do');

create type public.literacy as enum ('literate', 'illiterate', 'mixed');

create type public.lesson_block as enum (
  'anthem',
  'warm_up',
  'cool_down',
  'check_homework',
  'recap',
  'new_content',
  'cfu',
  'independent_practice',
  'exit_ticket',
  'homework'
);
