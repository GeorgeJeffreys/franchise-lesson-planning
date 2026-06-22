import type { Metadata } from "next";
import Link from "next/link";
import { updatePassword } from "@/lib/actions/auth";
import { AuthShell, AuthField } from "@/components/auth/AuthShell";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set password · Alsama Lesson Planner",
};

// Reads the session cookie to confirm an invite/recovery link landed the user
// here with a valid session, so it must render per-request.
export const dynamic = "force-dynamic";

/** User-facing copy for the error codes the updatePassword action redirects with. */
const ERRORS: Record<string, string> = {
  weak: "Choose a password of at least 8 characters.",
  mismatch: "Those passwords don't match. Please re-enter them.",
  failed: "Couldn't update your password. The link may have expired.",
};

/**
 * Set a new password. Reached after an invite or password-reset link has been
 * verified at /auth/callback, which establishes a session — so this page checks
 * for that session first. With no session (a stale or already-used link) it
 * sends the user to request a fresh one rather than showing a dead form.
 */
export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell>
        <h1 className="m-0 text-[25px] font-semibold">Link expired</h1>
        <p className="mt-2 text-[15px] leading-[1.55] text-text-muted">
          This link is invalid or has already been used. Request a new one to set
          your password.
        </p>
        <p className="mt-[24px] text-[13px]">
          <Link
            href="/login/reset"
            className="text-teal underline underline-offset-2 hover:text-teal-deep"
          >
            Send a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="m-0 text-[25px] font-semibold">Set your password</h1>
      <p className="mt-2 mb-[30px] text-[15px] leading-[1.55] text-text-muted">
        Choose a password for{" "}
        <span className="font-medium text-ink">{user.email}</span>. You&apos;ll
        use this with your Alsama email to sign in.
      </p>
      <form action={updatePassword} className="flex flex-col gap-4">
        <AuthField
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
        />
        <AuthField
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
        />
        {message ? (
          <p className="text-[12.5px] text-status-review" role="alert">
            {message}
          </p>
        ) : null}
        <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
      </form>
    </AuthShell>
  );
}
