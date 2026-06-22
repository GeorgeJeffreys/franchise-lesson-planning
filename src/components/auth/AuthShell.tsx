import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/Wordmark";

/**
 * The shared two-column auth card — a teal welcome panel beside a content panel,
 * collapsing to a single column on mobile. Matches the approved Login design and
 * is reused across sign-in, password-reset request, and set-new-password so the
 * three screens stay visually identical. The right-hand panel is the slot.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-[1100px]">
        <div className="grid overflow-hidden rounded-lg border border-border shadow-card md:h-[620px] md:grid-cols-[1.15fr_1fr]">
          {/* Brand / welcome panel */}
          <div className="stripe relative flex flex-col justify-between gap-12 bg-teal p-12 sm:p-[52px]">
            <Wordmark size="lg" tone="cream" />
            <div>
              <div className="mb-[14px] text-xs font-semibold uppercase tracking-[0.16em] text-cream/70">
                Lesson Planning
              </div>
              <p className="m-0 max-w-[400px] text-[28px] font-medium leading-[1.35] text-white">
                Turn the curriculum into a clear, well-structured 50-minute
                lesson — and submit it for approval.
              </p>
            </div>
            <div className="inline-flex items-center gap-[9px] text-[13px] text-cream/85">
              <span className="size-2 rounded-full bg-cream" />
              For Alsama teachers
            </div>
          </div>

          {/* Content panel */}
          <div className="flex flex-col justify-center bg-surface p-12 sm:p-[52px]">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * A labelled text input for the auth forms. `id` doubles as the field `name`, so
 * the value arrives in the server action's FormData under the same key.
 */
export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  required = true,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-[6px] block text-[13px] font-medium text-ink">
        {label}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-border-strong bg-surface px-[13px] py-[11px] text-[15px] text-ink placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      />
    </label>
  );
}
