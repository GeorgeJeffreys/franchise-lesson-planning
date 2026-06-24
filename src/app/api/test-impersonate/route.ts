import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  STASH_COOKIE,
  getAllowedUids,
  impersonationEnabled,
  isTestRole,
  roleToUid,
  stashCookieOptions,
  type ImpersonationStash,
} from '@/lib/test-impersonation';

/**
 * Dev/preview-only impersonation endpoint. POST a `{ role }` to view-as one of
 * the three pre-configured test users, or `{ action: 'return' }` to restore your
 * own account. SECURITY-SENSITIVE: it mints real Supabase sessions, so every
 * gate in `impersonationEnabled()` + the admin allowlist must hold or it 404s.
 *
 * The client only ever sends a role KEY; the server maps it to a UID from
 * server-only env. An arbitrary user id from the client is never honoured. The
 * service-role client is used only to mint the target's session and never
 * leaves the server.
 *
 * Session mechanism (matches this repo's @supabase/ssr cookie setup):
 *   - mint: service-role `generateLink({type:'magiclink'})` → cookie-bound
 *     `verifyOtp({token_hash})`, which swaps the auth cookies to the target.
 *   - return: the real session's tokens are stashed (httpOnly) before the first
 *     swap and restored with `setSession`, then the stash is cleared.
 */
export async function POST(request: NextRequest) {
  // Gate 1+2: feature flag on AND not production. Otherwise the route does not
  // exist as far as any caller is concerned.
  if (!impersonationEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const stash = readStash(cookieStore.get(STASH_COOKIE)?.value);

  // Gate 3: the REAL signed-in admin must be on the allowlist. While already
  // impersonating, the real admin is the stashed identity, not the cookie user.
  const realUid = stash?.uid ?? user.id;
  if (!getAllowedUids().includes(realUid)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { role?: unknown; action?: unknown }
    | null;

  // ── Return to my account ────────────────────────────────────────────────
  if (body?.action === 'return') {
    if (!stash) {
      return NextResponse.json({ ok: true, impersonating: false });
    }
    // setSession restores the real session (and refreshes it if the stashed
    // access token has since expired), writing the auth cookies back.
    const { error } = await supabase.auth.setSession({
      access_token: stash.access_token,
      refresh_token: stash.refresh_token,
    });
    if (error) {
      return NextResponse.json({ error: 'restore_failed' }, { status: 500 });
    }
    cookieStore.delete(STASH_COOKIE);
    return NextResponse.json({ ok: true, impersonating: false });
  }

  // ── Switch role ──────────────────────────────────────────────────────────
  if (!isTestRole(body?.role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }
  // Gate 4: the target is one of exactly three server-configured UIDs.
  const targetUid = roleToUid(body.role);
  if (!targetUid) {
    return NextResponse.json({ error: 'role_not_configured' }, { status: 400 });
  }

  // Stash the real session ONCE, before the first swap, so subsequent switches
  // (teacher → coordinator → …) don't overwrite it and "Return" still works.
  if (!stash) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'no_session' }, { status: 401 });
    }
    const toStash: ImpersonationStash = {
      uid: user.id,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
    cookieStore.set(STASH_COOKIE, JSON.stringify(toStash), stashCookieOptions());
  }

  // Mint a session for the target via the service-role client (server-only).
  const admin = createAdminClient();
  const { data: target, error: lookupError } = await admin.auth.admin.getUserById(targetUid);
  if (lookupError || !target?.user?.email) {
    return NextResponse.json({ error: 'target_unavailable' }, { status: 500 });
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.user.email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    return NextResponse.json({ error: 'mint_failed' }, { status: 500 });
  }

  // Verify on the cookie-bound client so the new session's cookies are written.
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyError) {
    return NextResponse.json({ error: 'verify_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, impersonating: true, role: body.role });
}

function readStash(raw: string | undefined): ImpersonationStash | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ImpersonationStash>;
    if (
      typeof parsed.uid === 'string' &&
      typeof parsed.access_token === 'string' &&
      typeof parsed.refresh_token === 'string'
    ) {
      return { uid: parsed.uid, access_token: parsed.access_token, refresh_token: parsed.refresh_token };
    }
    return null;
  } catch {
    return null;
  }
}
