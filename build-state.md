# Build state

Living record of what each phase delivered and what comes next. Update as you go.

## Phase 1 — Foundation ✅ (this phase)

Goal: a correct, deployable foundation. Scaffold + locked schema/migrations +
types + Supabase/auth plumbing + ported curriculum data layer. **No UI, design
system, login screen, lesson editor, or AI features.**

### Done

- **Scaffold** — fresh Next.js **16.2.9** App Router project (`alsama-lesson-planner`),
  TypeScript strict, Tailwind v4, ESLint, `@/*` → `./src/*`. create-next-app
  boilerplate removed (demo page, SVGs, default README/metadata, Geist fonts).
- **Supabase + auth plumbing**
  - `src/lib/supabase/server.ts` — cookie-bound server client (honors RLS).
  - `src/lib/supabase/client.ts` — browser client (anon key, honors RLS).
  - `src/lib/supabase/proxy.ts` + `src/proxy.ts` — session refresh + route
    protection. Next 16 renamed the `middleware` convention to **`proxy`**.
  - `src/lib/supabase/env.ts` — reads the client-safe env vars only.
  - `handle_new_user` trigger inserts a `profiles` row (role `teacher`) on
    `auth.users` insert (migration `0005`).
  - Temporary placeholder landing (`src/app/page.tsx`, force-dynamic) prints the
    signed-in user; public `/login` stub is the unauthenticated redirect target.
- **Database** — numbered migrations in `supabase/migrations/` + `supabase/config.toml`:
  - `0001` extensions + enums · `0002` core tables · `0003` lesson_plans (+
    `set_updated_at` trigger + indexes) · `0004` activity_bank · `0005`
    handle_new_user · `0006` RLS (every table, policies per spec).
- **Seed** — `supabase/seed.sql`: 2 schools, English subject, 3 classes, and the
  6-row activity_bank sample (3 `cfu` + 3 `exit_ticket`). profiles/class_teachers
  deferred (need real auth users).
- **Curriculum data layer (ported)** — `src/data/curriculum.json` (947 keys),
  `src/lib/curriculumUtils.ts`, `src/lib/curriculum-actions.ts`,
  `src/types/curriculum.ts`. Added centralized boundary cleaning
  (`cleanCurriculumData`): drops 22 `L.*` placeholder rows, scrubs 18 `"#N/A"`
  values. Added optional `subject?` field (unpopulated). Public API otherwise
  unchanged.
- **Domain types + defaults (hand-authored)** — `Block`, `SmarttCheck`,
  `LessonPlan`, `PlanStatus`, etc. in `src/types/lesson.ts`; `DEFAULT_BLOCKS`,
  `IN_SESSION_TARGET_MINUTES`, `inSessionMinutes()` in `src/lib/blocks.ts`.
- **Type generation** — `npm run gen:types` script + committed placeholder
  `src/types/database.types.ts` (overwritten on first real run).
- **Docs** — `AGENTS.md` (stack + conventions + 50-minute rule + Next-version
  discipline), `CLAUDE.md` (includes AGENTS.md), this file.

### Verified

- `npm run build` passes (Next 16.2.9). `npm run lint` clean.
- Route map: `/` dynamic (auth'd), `/login` static (public), Proxy active.
- Curriculum smoke check (throwaway, since removed): `getLessonsByWeek(0, 1)` →
  5 lessons; LO prefixes stripped; `L.*` lookup → `null`; a known `#N/A`
  `vocabFocus` → `""`.

### Not yet applied to a database

No Docker / Supabase CLI was available in this workspace, so the migrations and
seed were written and lint-reviewed but **not applied to a live DB**. To apply:

```bash
supabase start          # boot local stack (needs Docker)
supabase db reset       # apply migrations 0001–0006, then seed.sql
npm run gen:types       # regenerate src/types/database.types.ts
```

Or link a project (`supabase link --project-ref <ref>`) and `supabase db push`.

## Next slice (not started)

1. **Auth phase** — Microsoft SSO login UI + `/auth/callback` route; provision
   real users; seed `profiles` / `class_teachers`; replace the placeholder
   landing. (The `handle_new_user` trigger already makes first sign-in work.)
2. **Design system / tokens.**
3. **Lesson editor** — SMARTT objective + the 9 in-session blocks + activity bank.
4. **AI assistance**, **Word (.docx) export**, **coordinator UI**.
5. **Multi-subject curriculum** — populate `subject`, ingestion script (the old
   spreadsheet→JSON generator was never in the repo and must be rebuilt).
