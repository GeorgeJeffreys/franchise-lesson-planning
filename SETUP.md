# Setup — Supabase + Microsoft SSO

How to stand up the database and wire **Sign in with Microsoft** for the Alsama
Lesson Planner. Steps that require the Supabase dashboard or the Azure portal are
documented here rather than scripted, because they can't be done from the repo.

Order: **(A) database → (B) Entra app → (C) Supabase Azure provider → (D) Supabase
URLs → (E) env vars → (F) run → (G) provision a test teacher.**

---

## A. Apply migrations + seed

### Local (Supabase CLI, needs Docker)

```bash
supabase start            # boot the local stack
supabase db reset         # apply migrations 0001–0006, then supabase/seed.sql
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

## B. Register an app in Microsoft Entra ID

In the [Azure portal](https://portal.azure.com) → **Microsoft Entra ID** → **App
registrations** → **New registration**:

1. **Name:** e.g. `Alsama Lesson Planner`.
2. **Supported account types:** choose to match who signs in:
   - Single Alsama tenant → *Accounts in this organizational directory only*.
   - Any work/school account → *Accounts in any organizational directory*.
3. **Redirect URI:** platform **Web**, value =
   **`https://<your-project-ref>.supabase.co/auth/v1/callback`**
   (Supabase's callback, **not** the app's `/auth/callback`). For local Supabase
   use `http://localhost:54321/auth/v1/callback`.
4. Register, then note the **Application (client) ID** and **Directory (tenant)
   ID**.
5. **Certificates & secrets → New client secret** → copy the secret **Value**
   (shown once).
6. **API permissions:** Microsoft Graph delegated `openid`, `profile`, `email`
   (add `User.Read` if you want richer profile data). Grant admin consent if your
   tenant requires it.

---

## C. Enable the Azure provider in Supabase

Supabase dashboard → **Authentication → Providers → Azure**:

- **Enable** the provider.
- **Client ID** = Entra Application (client) ID.
- **Secret** = the Entra client secret **Value**.
- **Azure Tenant URL** =
  `https://login.microsoftonline.com/<tenant-id>` (use your Directory/tenant ID;
  for multi-tenant use `organizations` or `common`).
- Confirm the **Callback URL** shown matches the redirect URI you registered in
  step **B.3**.

The app requests the `azure` provider with scopes `openid profile email` and
`redirectTo = <origin>/auth/callback` (see
`src/components/auth/MicrosoftSignInButton.tsx`).

---

## D. Supabase Auth Site URL + redirect URLs

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** your primary app origin (e.g. `https://<app>.vercel.app`, or
  `http://localhost:3000` for local dev).
- **Redirect URLs (allow-list):** add every app origin's callback, since
  `redirectTo` must be allow-listed:
  - `http://localhost:3000/**`
  - `https://<app>.vercel.app/**`
  - your Vercel preview pattern if used, e.g. `https://<app>-*.vercel.app/**`

Without these, Supabase rejects the post-login redirect back to `/auth/callback`.

---

## E. Environment variables

Copy `.env.example` → `.env.local` and fill in the **client-safe** vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Both are public (browser-exposed) and honour RLS. The **service-role key** is for
admin/seed scripts only — never put it in `NEXT_PUBLIC_*` or a user request.

On **Vercel**, set the same two vars in the project's Environment Variables.

---

## F. Run

```bash
npm install
npm run dev      # http://localhost:3000
```

Visiting `/` while signed out redirects to `/login`. The flow:

```
/login → "Sign in with Microsoft" → Microsoft → Supabase callback
       → /auth/callback (code exchange) → / (authed shell)
```

`/login` and `/auth/callback` are public; everything else is protected by
`src/proxy.ts`.

---

## G. Provision a test teacher

After signing in once (which creates your `profiles` row via the
`handle_new_user` trigger), assign yourself a school, subject and classes so the
upcoming Weekly Overview has data:

1. Grab your auth uid — the landing page prints it, or use the dashboard
   (**Authentication → Users**).
2. Run `supabase/admin/assign_teacher.sql` (see `supabase/admin/README.md`):

   ```bash
   psql "$DATABASE_URL" -v teacher_email="'you@example.org'" \
     -f supabase/admin/assign_teacher.sql
   ```

This is an admin/service-role script — it bypasses RLS and must not run from the
app.
