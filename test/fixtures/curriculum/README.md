# Curriculum parity fixtures

Backs the parser parity gate (`src/lib/curriculum/__tests__/parity.test.ts`), which
proves the in-process SheetJS parser reproduces the live `curriculum_lesson` data
exactly, per subject, by `lesson_key`.

## What lives here

| Path | Committed? | Purpose |
|---|---|---|
| `*.xlsx` (7 subjects) | **No — gitignored** | the real curriculum workbooks (core IP) |
| `goldmaster/*.csv` | **No — gitignored** | full-text export of active `curriculum_lesson` rows |
| `goldmaster-redacted/*.csv` | **Yes** | structural columns + `<field>_present` booleans, **no text** |
| `README.md` | Yes | this file |

The workbooks and full CSVs are **core IP and must never enter git history** — the
repo `.gitignore` excludes `*.xlsx` and `goldmaster/`. Only the content-free
`goldmaster-redacted/` set is committed, and it's what the hard key-parity assertion
reads. The full-text CSVs power an extra field-value spot-check that self-skips when
they're absent (CI).

## Subjects

`english, arabic, maths, professionalism, science, it, yoga` — file per subject, named
by `subjects.code`. Awareness is out of scope (never imported; no gold master).

## Location override

By default everything resolves under `test/fixtures/curriculum/`. To keep the IP
files outside the working tree, set `CURRICULUM_FIXTURES_DIR` to a directory holding
`<subject>.xlsx` and `goldmaster/<subject>.csv`. The committed
`goldmaster-redacted/` set is always read from its in-repo path regardless.

## Gold-master CSV columns

`subject_code, year, month, week, period, lesson_key, daily_outcome, weekly_skills_lo,
weekly_knowledge_lo, monthly_lo, monthly_skills_lo, monthly_knowledge_lo,
grammar_vocabulary, theme, linguistic_skill`. Empty cells may be blank or the literal
`null`; both read as SQL NULL.

## Workflow

1. Drop the 7 workbooks here (or under `CURRICULUM_FIXTURES_DIR`).
2. Export active `curriculum_lesson` rows per subject into `goldmaster/<subject>.csv`.
3. `npm run redact:goldmaster` → regenerates the committed `goldmaster-redacted/` set.
4. `npm run parity:report` → prints matched/missing/extra per subject (no assertions).
5. `npm test` → the parity gate fails loudly on any subject whose key set diverges.

This gate is **local-only** (the workbooks it parses are gitignored), so it is
deliberately **not** wired into CI or any deploy check.
