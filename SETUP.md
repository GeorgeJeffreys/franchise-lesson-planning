# Setup — Supabase Auth (email + password)

How to stand up the database and wire **email + password sign-in** on each
teacher's **Alsama email** for the Alsama Lesson Planner. Microsoft Entra / Azure
SSO has been removed. Steps that require the Supabase dashboard are documented
here because they can't be scripted from the repo.

Order: **(A) database → (B) Supabase Auth providers → (C) Supabase URLs →
(D) email / SMTP → (E) env vars → (F) run → (G) invite a teacher →
(H) verify the bridge email.**

---

## A. Apply migrations + seed

### Local (Supabase CLI, needs Docker)

```bash
supabase start            # boot the local stack
supabase db reset         # apply migrations 0001–0008, then supabase/seed.sql
npm run gen:types         # regenerate src/types/database.types.ts from the DB
```

`supabase start` prints the local **API URL** and **anon key** (and a
service-role key for admin scripts only).

### Hosted project

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # apply migrations to the linked project
# then run supabase/seed.sql once (SQL editor, or psql) for reference data
npm run gen:types -- --project-id <your-project-ref>
```

The seed inserts 2 schools, the English subject, 3 classes, and a sample
activity bank. `profiles` / `class_teachers` are **not** seeded — they need real
auth users (see step **G**).

---

## B. Supabase Auth providers

Supabase dashboard → **Authentication → Providers**:

1. **Email** — *enable*. Turn on **email + password** (the "Enable Email
   provider" toggle, with the password method on). Leave **magic link** off if
   you want password-only.
2. **Azure** — *disable* (this app no longer uses Microsoft SSO). If it was never
   enabled on this project, there's nothing to do.

Supabase dashboard → **Authentication → Sign In / Providers → (sign-up
settings)** (or **Authentication → Settings**):

3. **Disable public sign-ups** — turn **"Allow new users to sign up"** OFF.
   Accounts are created by invite only (step **G**). The local stack mirrors this
   via `enable_signup = false` in `supabase/config.toml`.

---

## C. Supabase Auth Site URL + redirect URLs

Supabase dashboard → **Authentication → URL Configuration**. Invite and
password-reset emails link back to the app, so these must be set:

- **Site URL:** the primary production origin, e.g. `https://<app>.vercel.app`.
- **Redirect URLs (allow-list):** add every origin that may receive the email
  link's redirect (`redirectTo` must be allow-listed or Supabase rejects it):
  - `http://localhost:3000/**`            (local dev)
  - `https://<app>.vercel.app/**`         (production)
  - `https://<app>-*.vercel.app/**`       (Vercel preview deploys)

The app's email links return to **`/auth/callback`** (which then forwards invite
and recovery links to `/login/update-password`). The `/**` wildcard covers it.

---

## D. Email delivery / custom SMTP

The **built-in Supabase mailer is rate-limited (~a few emails/hour) and is not
production-grade** — it is fine only for a quick test.

For real use, configure **custom SMTP** in Supabase dashboard →
**Authentication → Emails → SMTP Settings** (e.g. Resend or SendGrid): sender
name/address, host, port, username, password. Until that's done, treat invites
and resets as **test-only** and expect throttling.

Optionally review the **Invite user** and **Reset password** email templates
(same screen). The defaults work with `/auth/callback`; no template edits are
required for this slice.

> ⚠️ **Test-only flag:** if you ship before configuring SMTP, only a handful of
> invite/reset emails will send per hour. Configure SMTP before onboarding teachers.

---

## E. Environment variables

Copy `.env.example` → `.env.local` and fill in the **client-safe** vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Both are public (browser-exposed) and honour RLS. The **service-role key** is for
admin/seed scripts only — never put it in `NEXT_PUBLIC_*` or a user request.
There are **no SSO provider secrets** to set anymore.

On **Vercel**, set the same two vars in the project's Environment Variables.

---

## F. Run

```bash
npm install
npm run dev      # http://localhost:3000
```

Visiting `/` while signed out redirects to `/login`. The flows:

```
Sign in:  /login → email + password → / (authed shell)
Invite:   invite email → /auth/callback (verify) → /login/update-password → /
Reset:    /login/reset → email → /auth/callback (verify) → /login/update-password → /
Sign out: shell "Sign out" → /login
```

`/login`, `/login/**`, and `/auth/**` are public; everything else is protected by
`src/proxy.ts`.

---

## G. Invite a teacher (account creation, v1)

Accounts are provisioned by **admin invite** — there is no self-serve sign-up.

Supabase dashboard → **Authentication → Users → Invite user** (or **Add user →
Send invitation**):

1. Enter the teacher's **exact Alsama email** (the same address PowerSchool
   stores and they used for Chalk). This becomes their sign-in identity **and**
   the bridge key the future schedule matcher joins on — type it precisely.
2. Supabase sends an invite email. The teacher clicks the link → lands on
   **Set your password** (`/login/update-password`) → chooses a password → is
   signed in and dropped into the app.
3. The `handle_new_user` trigger creates their `public.profiles` row
   automatically on user creation (role `teacher`). No manual profile step.

To give the teacher classes/data for the Weekly Overview, then run
`supabase/admin/assign_teacher.sql` (see `supabase/admin/README.md`).

---

## H. Verify the bridge email (do this for the test invite)

The schedule matcher (a later slice) joins teachers to their PowerSchool
schedule **on the Alsama email**. The canonical store for that email is
**`auth.users.email`**, reached 1:1 from `public.profiles` via
`profiles.id = auth.users.id` (there is intentionally **no** `profiles.email`
column — see "Bridge-email note" below). After inviting the test teacher,
confirm the stored email matches the invited address **exactly**.

Run `supabase/admin/verify_profile_email.sql` in the Supabase SQL editor (edit
the literal email at the top), or inline:

```sql
select
  p.id,
  u.email                                   as auth_email,
  (u.email = 'teacher@alsama.org') as matches_exactly,  -- ← put the invited email here
  p.full_name,
  p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'teacher@alsama.org';                   -- ← and here
```

Expect exactly one row with `matches_exactly = true`. That is the bridge
foundation this slice guarantees.

### Bridge-email note (why no `profiles.email` column)

The locked schema stores the email only in `auth.users.email`; `handle_new_user`
copies `id`, `full_name`, `role` into `profiles` and is intentionally left
unchanged. Because `profiles.id` is a 1:1 FK to `auth.users.id`, the Alsama email
is always reachable by joining the two (as `assign_teacher.sql` already does),
with no copy that could drift. If a later slice needs a denormalised
`profiles.email` for the join, that is a deliberate schema change (new column +
trigger update) to design then — not part of this auth slice.
