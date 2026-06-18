# Alsama Lesson Planner

A lesson-planning app for the Alsama Project. Teachers plan 50-minute lessons in
Alsama's format — a SMARTT objective plus a fixed sequence of timed blocks — using
pre-approved activities, and submit them to coordinators for approval. Multi-school,
multi-subject (English first), two roles (`teacher`, `coordinator`).

> **Status:** foundation phase. Schema, migrations, types, Supabase/auth plumbing,
> and the ported curriculum data layer are in place. No design system, login UI,
> lesson editor, or AI features yet. See [`build-state.md`](./build-state.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · Supabase
(Postgres + Auth, Microsoft SSO via `@supabase/ssr`) · Vercel.

## Getting started

```bash
cp .env.example .env.local   # fill in the Supabase values
npm install
npm run dev                  # http://localhost:3000
```

While signed out, every route redirects to `/login`. The Microsoft SSO login UI
lands in the next phase.

## Database

Schema lives in [`supabase/migrations/`](./supabase/migrations) (the locked source
of truth). With Docker + the Supabase CLI:

```bash
supabase start        # boot the local stack
supabase db reset     # apply migrations, then supabase/seed.sql
npm run gen:types     # regenerate src/types/database.types.ts
```

## Conventions

See [`AGENTS.md`](./AGENTS.md): auth'd Supabase clients only (never the
service-role key in user requests), the schema as source of truth, the
50-minute rule, and the Next.js-version-check discipline.
