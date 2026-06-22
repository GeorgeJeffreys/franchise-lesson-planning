import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "@/lib/actions/auth";
import { AuthShell, AuthField } from "@/components/auth/AuthShell";
import { SubmitButton } from "@/components/auth/SubmitButton";

export const metadata: Metadata = {
  title: "Sign in · Alsama Lesson Planner",
};

/** User-facing copy for the error codes the sign-in / callback flows redirect with. */
const ERRORS: Record<string, string> = {
  missing: "Enter your Alsama email and password.",
  invalid: "That email and password don't match. Please try again.",
  exchange_failed: "That link is invalid or has expired. Request a new one.",
  missing_code: "That link is invalid or has expired. Request a new one.",
};

/**
 * Email + password sign-in on the teacher's Alsama email (Supabase Auth). The
 * form posts to the signIn server action, which sets the session cookies and
 * redirects into the app; failures redirect back here with an ?error code.
 * Accounts are invite-only — there is no public sign-up link.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null;

  return (
    <AuthShell>
      <h1 className="m-0 text-[25px] font-semibold">Welcome back</h1>
      <p className="mt-2 mb-[30px] text-[15px] leading-[1.55] text-text-muted">
        Sign in with your Alsama email to plan and track your lessons for the
        week.
      </p>
      <form action={signIn} className="flex flex-col gap-4">
        <AuthField id="email" label="Alsama email" type="email" autoComplete="email" />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
        />
        {message ? (
          <p className="text-[12.5px] text-status-review" role="alert">
            {message}
          </p>
        ) : null}
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
      <p className="mt-[18px] text-[13px]">
        <Link
          href="/login/reset"
          className="text-teal underline underline-offset-2 hover:text-teal-deep"
        >
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-[12.5px] text-text-faint">
        Trouble signing in? Ask your centre coordinator.
      </p>
    </AuthShell>
  );
}
