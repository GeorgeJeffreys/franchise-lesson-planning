-- seed.sql
-- Seed reference data: schools, the English subject, classes, and a sample of
-- the activity_bank. Runs after migrations (supabase db reset / supabase start).
--
-- profiles and class_teachers are intentionally NOT seeded: they require real
-- auth users and are handled in the auth phase.

insert into public.schools (name) values
  ('Shatila Centre'),
  ('Bourj al-Barajneh Centre');

insert into public.subjects (name, code) values
  ('English', 'english');

-- classes (school · subject English · year · group · literacy)
insert into public.classes (school_id, subject_id, year, group_label, literacy)
select s.id, sub.id, c.year, c.group_label, c.literacy::public.literacy
from (values
  ('Shatila Centre',           1, 'A', 'illiterate'),
  ('Shatila Centre',           2, 'A', 'mixed'),
  ('Bourj al-Barajneh Centre', 3, 'A', 'literate')
) as c(school_name, year, group_label, literacy)
join public.schools s on s.name = c.school_name
join public.subjects sub on sub.code = 'english';

-- activity_bank sample (full content is a later task; these exercise the shape)
insert into public.activity_bank (block_type, name, summary, illiterate_instructions, literate_instructions, sort_order) values
  ('cfu', 'Fist to Five', 'Quick self-rating of understanding.',
    'Hold up 0–5 fingers for how well they understand.',
    'Write the number plus one thing they still need help with.', 1),
  ('cfu', 'Whiteboard / Show Me', 'Students show an answer on a small board or sticky note.',
    'Draw or circle the answer.',
    'Write a word or short sentence.', 2),
  ('cfu', 'Think-Pair-Share', 'Discuss with a partner then share.',
    'Turn to a partner and say one thing.',
    'Say it, then write what your partner said.', 3),
  ('exit_ticket', '3-2-1', 'Reflect at the end of the lesson.',
    'Say 3 things learned, 2 questions, 1 thing they liked.',
    'Write them.', 1),
  ('exit_ticket', 'Draw it', 'Represent the learning in a picture.',
    'Draw a picture of what they learned.',
    'Draw it and label with 1–3 words.', 2),
  ('exit_ticket', 'Finish the sentence', 'Complete a stem.',
    'Complete "Today I…" out loud.',
    'Complete it in writing.', 3);
