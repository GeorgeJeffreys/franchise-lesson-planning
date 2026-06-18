import type { ReactNode } from "react";
import { SignOutForm } from "@/components/app-shell/SignOutForm";
import { Wordmark } from "@/components/ui/Wordmark";

type AppShellProps = {
  /** The signed-in user's display name (full_name, falling back to email). */
  name: string;
  /** Optional second line, e.g. "Shatila Centre · English". */
  subtitle?: string;
  children: ReactNode;
};

/** Up-to-two-letter initials for the avatar, derived from the display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Minimal authenticated app shell — the shared chrome from the Weekly Overview
 * design (wordmark, signed-in user, sign-out), wrapping a page body. The real
 * Weekly Overview content fills `children` in the next slice.
 */
export function AppShell({ name, subtitle, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Wordmark size="md" tone="brand" />
            <span className="h-[26px] w-px bg-neutral-300" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
              Lesson Planning
            </span>
          </div>

          {/* Signed-in user + sign-out */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-[42px] items-center justify-center rounded-full bg-teal text-[15px] font-semibold text-white">
                {initials(name)}
              </span>
              <div className="leading-tight">
                <div className="text-[16px] font-semibold">{name}</div>
                {subtitle ? (
                  <div className="text-[13px] text-neutral-600">{subtitle}</div>
                ) : null}
              </div>
            </div>
            <SignOutForm />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[1240px] px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
