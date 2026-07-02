import 'server-only';

import { cookies } from 'next/headers';
import {
  DEFAULT_COOKIE_OPTIONS,
  combineChunks,
  createChunks,
  isChunkLike,
  stringToBase64URL,
} from '@supabase/ssr';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { isTestRole, type Persona } from '@/lib/test-roles';

export { isTestRole, type Persona, type TestRole } from '@/lib/test-roles';

/**
 * Dev/preview-only test-user impersonation — the eligibility gates, the persona
 * enumeration, and the server-side "should the bar render?" check. Shared by the
 * impersonate route (`src/app/api/test-impersonate/route.ts`) and the authed shell.
 *
 * This is SECURITY-SENSITIVE: passing the gates lets an eligible tester step into
 * a dedicated per-tester persona so they can see that teacher's true, RLS-scoped
 * UX under the per-teacher plan-ownership model. The session is a genuine,
 * Supabase-issued one (the route signs in as the persona with its email + the
 * shared, server-only TEST_PERSONA_PASSWORD); we never self-sign a token.
 *
 * `server-only` guarantees this module can never be bundled for the browser, so
 * the shared persona password and persona emails never leak. No NEXT_PUBLIC_* here.
 */

/** httpOnly cookie holding the real caller's stashed session (for "Return"). */
export const STASH_COOKIE = 'test-impersonation-stash';

/**
 * Shape stashed in {@link STASH_COOKIE}: the real user's id + their ENTIRE
 * Supabase session (access + refresh + expiry + user). We stash the whole
 * session so "Return" can resume it by writing the auth cookies directly — with
 * no `setSession` round-trip that would re-validate or rotate a refresh token
 * that may already have been spent by the time the user returns.
 */
export interface ImpersonationStash {
  uid: string;
  session: Session;
}

/** next/headers cookie store (writable inside Route Handlers). */
type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * The cookie name `@supabase/ssr` stores the session under. supabase-js derives
 * the default storage key from the project URL as `sb-<ref>-auth-token`; we
 * mirror that here so a direct write lands where the SSR client will read it.
 */
export function authTokenCookieName(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL; cannot derive the auth cookie name.');
  }
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/**
 * Whether a stashed session's access token is still good enough to resume
 * without a refresh. `expires_at` is in seconds; a small skew avoids handing
 * back a token that is about to expire. A missing/absent expiry is treated as
 * unusable (force the clean login fallback rather than a guess).
 */
export function isStashedSessionResumable(session: Session): boolean {
  if (!session?.access_token || !session?.refresh_token) return false;
  const expiresAt = session.expires_at;
  if (typeof expiresAt !== 'number') return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt > nowSeconds + 10;
}

/**
 * Write a real session back into the SSR auth cookie(s) directly, in exactly the
 * format `@supabase/ssr` reads (base64url-prefixed value, chunked under the
 * storage key). No server round-trip, so a possibly-rotated refresh token is
 * never replayed. Any stale chunks from the prior (impersonated) session are
 * removed first.
 */
export function writeSessionToAuthCookies(cookieStore: CookieStore, session: Session): void {
  const key = authTokenCookieName();
  const encoded = `base64-${stringToBase64URL(JSON.stringify(session))}`;
  const chunks = createChunks(key, encoded);
  const nextNames = new Set(chunks.map((c) => c.name));

  // Drop any existing chunk cookies for this key that the new write won't cover.
  for (const { name } of cookieStore.getAll()) {
    if (isChunkLike(name, key) && !nextNames.has(name)) {
      cookieStore.delete(name);
    }
  }
  for (const { name, value } of chunks) {
    cookieStore.set(name, value, { ...DEFAULT_COOKIE_OPTIONS });
  }
}

/** Remove every auth-token chunk cookie — used when there is no resumable session. */
export function clearAuthCookies(cookieStore: CookieStore): void {
  const key = authTokenCookieName();
  for (const { name } of cookieStore.getAll()) {
    if (isChunkLike(name, key)) cookieStore.delete(name);
  }
}

/**
 * The master switch. The bar renders and the route acts ONLY when the explicit
 * `ENABLE_TEST_IMPERSONATION` flag is set. Absence of the flag is off.
 *
 * Production is refused by default: when `VERCEL_ENV === 'production'` the bar is
 * permitted ONLY if the separate, explicit `ALLOW_IMPERSONATION_IN_PRODUCTION`
 * flag is also `'true'`. This second flag exists so enabling impersonation in
 * production is a deliberate, easily-removable opt-in (testers-only deployment)
 * rather than a silent deletion of the guard — leave it unset for real users.
 * Outside production this flag is irrelevant; the master switch is all that's
 * needed.
 */
export function impersonationEnabled(): boolean {
  if (process.env.ENABLE_TEST_IMPERSONATION !== 'true') return false;
  if (
    process.env.VERCEL_ENV === 'production' &&
    process.env.ALLOW_IMPERSONATION_IN_PRODUCTION !== 'true'
  ) {
    return false;
  }
  return true;
}

/**
 * Env-allowlist eligibility fallback from `TEST_IMPERSONATION_ALLOWED_UIDS`
 * (comma-separated). Retained so the current allowlisted account's access to the
 * bar is unbroken even before anyone is flagged `can_impersonate`. Dynamic
 * eligibility (the `can_impersonate` flag / real-admin status) is layered on top
 * in {@link isEligibleCaller}.
 */
export function getAllowedUids(): string[] {
  return (process.env.TEST_IMPERSONATION_ALLOWED_UIDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The shared, server-only password every seeded persona signs in with. Returns
 * `null` (never a value) when unset/empty so the caller can report
 * `stage:'config'` without leaking anything. No NEXT_PUBLIC_*: server-only.
 */
export function getPersonaPassword(): string | null {
  // Do NOT trim — a credential is taken verbatim.
  const pw = process.env.TEST_PERSONA_PASSWORD;
  return pw ? pw : null;
}

/** Server-only enumeration shape: {@link Persona} plus the sign-in email. */
interface PersonaWithEmail extends Persona {
  email: string;
}

/** Strip the server-only email before a persona is handed to the client. */
function sanitizePersona({ id, name, role, centre }: PersonaWithEmail): Persona {
  return { id, name, role, centre };
}

/**
 * A Supabase client authenticated as the given (real caller's) session, WITHOUT
 * touching cookies or refreshing tokens. Used to enumerate/validate personas as
 * the real caller even while the live cookie session is the impersonated persona
 * — the definer RPC (`list_impersonation_personas`) then scopes to the real
 * caller's eligibility and admin status. If the access token has since expired
 * the RPC simply fails and the list comes back empty (Return still works).
 */
export function createSessionClient(session: Session): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}

/** Raw row shape returned by the `list_impersonation_personas` RPC. */
interface RawPersonaRow {
  persona_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  centre_name: string | null;
}

/**
 * Enumerate the caller-scoped personas via the security-definer RPC. The RPC
 * gates on real-admin OR `can_impersonate` and applies the anti-escalation scope
 * (non-admins see teacher personas only), so the returned list is already safe to
 * act on. Returns `[]` on any error (ineligible caller, expired stash token, RPC
 * missing) — the picker then shows its empty state rather than surfacing a 500.
 */
export async function listImpersonationPersonas(
  client: SupabaseClient,
): Promise<PersonaWithEmail[]> {
  const { data, error } = await client.rpc('list_impersonation_personas');
  if (error || !data) return [];
  return (data as RawPersonaRow[])
    .filter((r) => typeof r.email === 'string' && r.email.length > 0)
    .map((r) => ({
      id: r.persona_id,
      name: r.full_name?.trim() || (r.email as string),
      role: isTestRole(r.role) ? r.role : 'teacher',
      centre: r.centre_name ?? null,
      email: r.email as string,
    }));
}

/**
 * Whether `uid` may USE the bar (step into a persona). Dynamic eligibility =
 * `profiles.can_impersonate` OR real-admin (`profiles.role = 'admin'`), with the
 * `TEST_IMPERSONATION_ALLOWED_UIDS` env allowlist kept as a fallback. Reads only
 * the caller's OWN profile row (allowed by `profiles_select_own` RLS), so `client`
 * must be authenticated as `uid`. It is deliberately NOT gated on coordinator role
 * and never promotes anyone.
 */
export async function isEligibleCaller(client: SupabaseClient, uid: string): Promise<boolean> {
  if (getAllowedUids().includes(uid)) return true;
  const { data } = await client
    .from('profiles')
    .select('role, can_impersonate')
    .eq('id', uid)
    .maybeSingle();
  const row = data as { role: string | null; can_impersonate: boolean | null } | null;
  return !!row && (row.can_impersonate === true || row.role === 'admin');
}

/** Cookie options for the stash — server-set, httpOnly, never readable by JS. */
export function stashCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Long enough for a testing session; "Return" clears it explicitly.
    maxAge: 60 * 60 * 8,
  };
}

/**
 * Persist the stash, CHUNKED, under {@link STASH_COOKIE}. The stash holds the
 * whole real session (incl. the Azure user object), which routinely exceeds the
 * ~4KB single-cookie limit — an oversized cookie is silently dropped by the
 * browser, which is what made the stash vanish mid-impersonation (bar gone, and
 * Return seeing only the test user). Chunking mirrors how `@supabase/ssr` stores
 * the auth cookie. Stale chunks from a prior stash are removed first.
 */
export function writeStash(cookieStore: CookieStore, stash: ImpersonationStash): void {
  const chunks = createChunks(STASH_COOKIE, JSON.stringify(stash));
  const nextNames = new Set(chunks.map((c) => c.name));
  for (const { name } of cookieStore.getAll()) {
    if (isChunkLike(name, STASH_COOKIE) && !nextNames.has(name)) cookieStore.delete(name);
  }
  for (const { name, value } of chunks) cookieStore.set(name, value, stashCookieOptions());
}

/** Read + reassemble the (possibly chunked) stash, validating its shape. */
export async function readStash(cookieStore: CookieStore): Promise<ImpersonationStash | null> {
  const raw = await combineChunks(STASH_COOKIE, (name) => cookieStore.get(name)?.value ?? null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ImpersonationStash>;
    const session = parsed.session;
    if (
      typeof parsed.uid === 'string' &&
      session &&
      typeof session.access_token === 'string' &&
      typeof session.refresh_token === 'string'
    ) {
      return { uid: parsed.uid, session };
    }
    return null;
  } catch {
    return null;
  }
}

/** Remove every stash chunk cookie. */
export function clearStash(cookieStore: CookieStore): void {
  for (const { name } of cookieStore.getAll()) {
    if (isChunkLike(name, STASH_COOKIE)) cookieStore.delete(name);
  }
}

export interface ImpersonationState {
  /** Whether the bar should render at all (all non-target gates passed). */
  active: boolean;
  /** Whether a real session is currently stashed (i.e. we are viewing-as). */
  impersonating: boolean;
  /** The persona currently being viewed, when impersonating. */
  currentPersona: Persona | null;
  /** The caller-scoped personas the picker may offer (client-safe, no emails). */
  personas: Persona[];
}

const INACTIVE: ImpersonationState = {
  active: false,
  impersonating: false,
  currentPersona: null,
  personas: [],
};

/**
 * Server-side decision for the authed shell: should the test bar render, whose
 * persona is being viewed, and which personas may be picked?
 *
 *   - Impersonating: a VALID STASH is itself proof the session began from an
 *     eligible caller (the route only ever writes it after the eligibility gate),
 *     so the bar renders regardless of the now-impersonated session's state — the
 *     only in-app way back must never disappear. Personas are enumerated AS THE
 *     REAL caller (via the stashed session), so the picker stays populated and
 *     correctly scoped; the current persona is that list entry matching the live
 *     session's uid.
 *   - Not impersonating: the bar renders only for an eligible real caller
 *     (`can_impersonate` OR admin OR the env allowlist), who may then start.
 */
export async function getImpersonationState(): Promise<ImpersonationState> {
  if (!impersonationEnabled()) return INACTIVE;

  const cookieStore = await cookies();
  const stash = await readStash(cookieStore);

  if (stash) {
    // Enumerate as the real caller, not the impersonated session.
    const privileged = createSessionClient(stash.session);
    const withEmail = await listImpersonationPersonas(privileged);
    const personas = withEmail.map(sanitizePersona);

    // The current persona is the live (impersonated) session's user.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const current = user ? personas.find((p) => p.id === user.id) ?? null : null;

    return { active: true, impersonating: true, currentPersona: current, personas };
  }

  // Not impersonating: the bar shows only for an eligible real caller.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isEligibleCaller(supabase, user.id))) return INACTIVE;

  const personas = (await listImpersonationPersonas(supabase)).map(sanitizePersona);
  return { active: true, impersonating: false, currentPersona: null, personas };
}
