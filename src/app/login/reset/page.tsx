import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { AuthShell, AuthField } from "@/components/auth/AuthShell";
import { SubmitButton } from "@/components/auth/SubmitButton";

export const metadata: Metadata = {
  title: "Reset password · Alsama Lesson Planner",
};

/**
 * Request a password-reset link. Posts to the requestPasswordReset action, which
 * emails a recovery link and redirects back with ?sent=1. The confirmation is
 * deliberately neutral (doesn't reveal whether the email has an account).
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  if (sent) {
    return (
      <AuthShell>
        <h1 className="m-0 text-[25px] font-semibold">Check your email</h1>
        <p className="mt-2 text-[15px] leading-[1.55] text-text-muted">
          If an account exists for that Alsama email, we&apos;ve sent a link to
          reset your password. The link expires after a short while, so use it
          soon.
        </p>
        <p className="mt-[24px] text-[13px]">
          <Link
            href="/login"
            className="text-teal underline underline-offset-2 hover:text-teal-deep"
          >
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="m-0 text-[25px] font-semibold">Reset your password</h1>
      <p className="mt-2 mb-[30px] text-[15px] leading-[1.55] text-text-muted">
        Enter your Alsama email and we&apos;ll send you a link to set a new
        password.
      </p>
      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <AuthField id="email" label="Alsama email" type="email" autoComplete="email" />
        {error ? (
          <p className="text-[12.5px] text-status-review" role="alert">
            Enter your Alsama email.
          </p>
        ) : null}
        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </form>
      <p className="mt-[18px] text-[13px]">
        <Link
          href="/login"
          className="text-teal underline underline-offset-2 hover:text-teal-deep"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
