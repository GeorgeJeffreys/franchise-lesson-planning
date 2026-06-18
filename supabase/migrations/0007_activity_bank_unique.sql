-- 0007_activity_bank_unique.sql
-- A (block_type, name) is the natural key for a pre-approved activity. Adding a
-- UNIQUE constraint lets the seed upsert (insert … on conflict … do update) so
-- activity ids stay stable across re-seeds — lesson_plans.blocks may reference
-- an activity id (Block.activity_ref).

alter table public.activity_bank
  add constraint activity_bank_block_type_name_key unique (block_type, name);
