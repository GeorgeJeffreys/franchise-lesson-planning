"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Absolute origin of the current request, used to build the redirect URL baked
 * into password-reset emails. Honours the Vercel proxy headers so it resolves to
 * the production / preview domain rather than an internal host.
 */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Sign in with the teacher's Alsama email + password. The cookie-bound server
 * client writes the session cookies, so a successful sign-in lands them in the
 * app. Errors are surfaced via a redirect back to /login with an error code (no
 * client JS needed); we deliberately keep the message generic.
 */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }

  redirect("/");
}

/**
 * Start the password-reset flow: email the teacher a recovery link that returns
 * to /auth/callback and then to the set-new-password screen. We always redirect
 * to the same neutral "check your email" state regardless of whether the address
 * has an account, to avoid leaking which emails are registered.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/login/reset?error=missing");
  }

  const supabase = await createClient();
  const origin = await siteOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/login/update-password`,
  });

  redirect("/login/reset?sent=1");
}

/**
 * Set a new password for the currently-authenticated user. Reached after an
 * invite or recovery link has established a session (via /auth/callback). On
 * success the teacher is fully signed in and lands in the app.
 */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect("/login/update-password?error=weak");
  }
  if (password !== confirm) {
    redirect("/login/update-password?error=mismatch");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/login/update-password?error=failed");
  }

  redirect("/");
}

/**
 * Sign the current user out and return them to the public login screen. Wired to
 * the shell's sign-out control via a plain <form action={signOut}> — no client
 * component needed. The auth'd server client clears the session cookies.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
