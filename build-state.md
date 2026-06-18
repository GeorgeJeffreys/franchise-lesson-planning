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

## Phase 2 — Design foundation + Microsoft SSO ✅ (this phase)

Goal: a design-token layer from the approved design, a minimal primitive set, a
minimal authed app shell, and a working Microsoft SSO login. **Stops before the
Weekly Overview content, curriculum browser, lesson editor, AI, and Word export.**

### Done

- **Design source of truth** — vendored the approved Claude Design HTML into
  `design-reference/` (`Login`, `Weekly Overview`, `Curriculum Browser`, `Lesson
  Plan Editor`, `support.js` + README). Login drives `/login`; Weekly Overview
  drives the shared chrome.
- **Design tokens** (`src/app/globals.css`, Tailwind v4 CSS-first `@theme`) —
  brand (pink/teal/cream), a warm neutral ramp, semantic surface/text/border
  tokens, the 5 Weekly-Overview status colours (fg/bg/border each), radii,
  `shadow-card`, and a `.stripe` utility. Base styles set the sand background and
  Sora body type. Tokens are sampled from the design, not invented.
- **Fonts** (`src/app/fonts.ts`) — Sora (UI) and Sacramento (wordmark only) via
  `next/font/google`, wired to `--font-sans` / `--font-display` and applied on
  `<html>` in `layout.tsx`.
- **UI primitives** (`src/components/ui/`) — `Button` (primary/secondary ×
  sm/md), `Wordmark` (Sacramento), `Card`. Plus `src/lib/cn.ts`. Deliberately no
  form-field primitive: the SSO login has no inputs.
- **Auth flow** (`@supabase/ssr`, PKCE):
  - `/login` (`src/app/login/page.tsx`) — two-pane design; teal welcome panel +
    `MicrosoftSignInButton` (client) calling `signInWithOAuth({ provider: 'azure',
    redirectTo: <origin>/auth/callback, scopes: 'openid profile email' })`.
  - `/auth/callback` (`src/app/auth/callback/route.ts`) — exchanges the code for
    a session, backfills `profiles.full_name` from the identity if missing
    (safety net), redirects to `/`. Open-redirect-safe `next` handling.
  - `signOut` server action (`src/lib/actions/auth.ts`) → `/login`.
  - `src/proxy.ts` already treats `/login` and `/auth` (incl. `/auth/callback`)
    as public; everything else protected.
- **App shell** (`src/components/app-shell/`) — `AppShell` (top-bar chrome:
  wordmark + signed-in user + sign-out) wrapping the landing. `SignOutForm` posts
  to the server action. `src/app/page.tsx` now renders the shell + a placeholder
  body ("Signed in as {name} — your weekly overview is coming next") and
  temporarily prints the auth uid for provisioning.
- **Admin provisioning** — `supabase/admin/assign_teacher.sql` (+ README): sets a
  profile's school/subject to the seeded English values and assigns the seeded
  classes; idempotent; service-role only.
- **Docs** — `SETUP.md` (DB apply, Entra app registration, Supabase Azure
  provider, site/redirect URLs, env vars, run, test-teacher provisioning).

### Verified

- `npm run build` passes (Next 16.2.9). `npm run lint` clean.
- Route map: `/` dynamic, `/auth/callback` dynamic (route handler), `/login`
  static, Proxy active.
- Full end-to-end Microsoft login still needs the Entra + Supabase config in
  `SETUP.md`; the code wiring and non-auth rendering are correct without it.

## Phase 3 — Lesson Plan Editor ✅ (this phase, editor branch)

Goal: the editor for an **existing** plan — the core screen where a teacher
writes a 50-minute lesson. Built in parallel with the Weekly Overview on a
separate branch, kept to disjoint files (all new code under editor-specific
paths; shared files are imported, never modified). **Stops before** the
plan-creation flow / curriculum picker, AI features, and Word export.

### Done

- **Route `app/plan/[id]`** (`src/app/plan/[id]/page.tsx`, force-dynamic) — a
  server component that loads the plan with the auth'd client (RLS), 404s via
  `notFound()` when missing/not permitted, and hands off to the client editor
  inside the existing `AppShell`.
- **Data layer** (`src/lib/editor/load-plan.ts`) — `loadPlanForEditor(id)` joins
  the plan → class (school/subject/year/group/literacy), resolves the locked
  curriculum context (daily LO, focus area = linguistic skill, theme) from
  `curriculum_lesson_id` via the curriculum utils, and loads `activity_bank`
  rows for the blocks that have them (`cfu`, `exit_ticket`). Returns one
  serializable `EditorPlanData`. (The Supabase client is still untyped — the
  generated `Database` is a placeholder — so the joined rows are shaped by hand.)
- **Server actions** (`src/lib/actions/lesson-plan.ts`) — `saveLessonPlan`
  (autosave objective + blocks) and `submitLessonPlan` (persist, then set
  `status='submitted'` + `submitted_at`, guarded by a non-empty objective). Both
  go through the auth'd client; RLS scopes the write.
- **Editor components** (`src/components/editor/`):
  - `LessonPlanEditor` (client orchestrator) — holds objective/blocks/selection
    state, **debounced autosave (~1.5 s)** with a Saving/Saved indicator, and the
    submit flow.
  - `EditorHeader` — slim header carrying **curriculum context only** (class ·
    date · centre · focus area · theme + daily LO), the save indicator, a
    disabled **Export to Word**, and **Submit for approval**.
  - `SmarttObjectiveBox` — the pink box; the single home of the objective. The
    opening stem is enforced (shown muted, teacher edits only the remainder); the
    six SMARTT criteria are guidance chips; **"Check my objective" is rendered but
    un-wired** (no faked results).
  - `BlockList` — left summary in `DEFAULT_BLOCKS` order (name · phase tag ·
    duration · live content preview), routines grouped, homework separated, and a
    **timing meter** (in-session total excluding homework vs 50 min, with an
    over-target warning).
  - `BlockPanel` — the selected block: title + "?" guidance, a phase dropdown,
    **activities-first** (cfu/exit_ticket cards first; "?" reveals literate/
    illiterate variants per class literacy; Add prefills the fields), then the
    editing fields (Teacher does · Students do · **Resources** · Duration).
  - `ActivityCard`, `fields` (Textarea/Select/FieldLabel primitives).
- **Editor helpers** — `src/lib/block-guidance.ts` (Purpose/Technique/Success per
  block type), `src/lib/editor/objective.ts` (stem enforce/strip/compose + SMARTT
  criteria), `src/lib/editor/phase.ts` (phase tag/label/options).
- **Test seed** — `supabase/admin/seed_one_plan.sql`: one `in_progress` plan for
  the seeded Shatila · Year 2 · Group A class, `blocks = DEFAULT_BLOCKS`,
  `curriculum_lesson_id = 1.S5.K0.H2` (a real Year 2 Reading / "Food and drinks"
  lesson). Parameterized by `teacher_uid`; prints the new plan id. Run note in
  the file header (run `assign_teacher.sql` first).

### Verified

- `npm run build` passes (Next 16.2.9); `npm run lint` clean. Route map adds
  `/plan/[id]` (dynamic). No globals.css/AppShell/shared-type changes (clean
  merge with the overview branch expected; only build-state.md / lockfile may
  conflict).
- Not applied to a live DB in this workspace (no Docker/Supabase CLI). To test:
  apply migrations + seed, provision a teacher (`assign_teacher.sql`), run
  `seed_one_plan.sql`, open `/plan/<printed id>`.

## Next slice (not started)

1. **Bridge after merge** — the plan-creation flow + curriculum picker, wiring
   the Weekly Overview's empty slots to create plans the editor then opens.
2. **AI assistance** — objective check (wire the existing affordance) + activity
   suggestions.
3. **Word (.docx) export**, **coordinator review UI**.
4. **Full activity-bank + guidance content** (beyond the current sample).
5. **Multi-subject curriculum** — populate `subject`, ingestion script (the old
   spreadsheet→JSON generator was never in the repo and must be rebuilt).
