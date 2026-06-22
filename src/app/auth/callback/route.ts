import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback for email links — invite, password recovery, and any future
 * email-based flow. Supabase sends the user here with EITHER:
 *   - `token_hash` + `type`  → verified with verifyOtp (the email-template flow), or
 *   - `code`                 → exchanged via exchangeCodeForSession (PKCE).
 * Both establish the session cookies through the @supabase/ssr server client.
 *
 * Invite and recovery links require the user to set a password, so they are sent
 * on to /login/update-password. Public route (see src/lib/supabase/proxy.ts); on
 * any failure we return to /login rather than into a protected page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only honour same-origin relative paths to avoid an open-redirect.
  const nextParam = searchParams.get("next");
  let next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  const supabase = await createClient();

  let authFailed = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    authFailed = Boolean(error);
    // Invite and recovery have no usable password yet → force the set-password step.
    if (!error && (type === "invite" || type === "recovery") && next === "/") {
      next = "/login/update-password";
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authFailed = Boolean(error);
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  if (authFailed) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Safety net: the handle_new_user trigger creates the profiles row on first
  // sign-in, but if full_name didn't make it (older row, missing claim), backfill
  // it from the signed-in identity. RLS lets a user update only their own row.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const identityName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null;

    if (identityName) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && !profile.full_name) {
        await supabase
          .from("profiles")
          .update({ full_name: identityName })
          .eq("id", user.id);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
