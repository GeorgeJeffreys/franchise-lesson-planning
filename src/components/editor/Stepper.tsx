'use client';

import type { ReactNode } from 'react';

export const WIZARD_STEPS: { label: string }[] = [
  { label: 'Objective' },
  { label: 'Teach it' },
  { label: 'Practise' },
  { label: 'Link it' },
  { label: 'Review' },
];

export const STEP_COUNT = WIZARD_STEPS.length;

/**
 * The stepper band: five clickable steps (done = teal check, current = pink
 * halo, upcoming = muted) joined by connectors that fill teal as you advance,
 * with the Back + Next/Submit group pinned to the right end.
 */
export function Stepper({
  step,
  onGo,
  onBack,
  onNext,
  nextLabel,
  submitSlot,
}: {
  step: number;
  onGo: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  /** Rendered in place of "Next" on the final step (the submit control). */
  submitSlot: ReactNode;
}) {
  const isLast = step === STEP_COUNT;
  return (
    <div className="border-b border-[#EFE8DD] px-[22px] py-[15px] lg:px-[30px]">
      <div className="flex items-center">
        {/* Each stage cell is flex-1 so ALL five cells share equal width and
            the layout is identical regardless of which step is active.
            The connector lives inside the cell (except for the last stage). */}
        {WIZARD_STEPS.map((s, i) => {
          const no = i + 1;
          const isDone = step > no;
          const isCur = step === no;
          const showConn = i < STEP_COUNT - 1;
          return (
            <div
              key={s.label}
              className="flex min-w-0 flex-1 items-center"
            >
              <button
                type="button"
                onClick={() => onGo(no)}
                className="flex items-center gap-[10px] text-left"
              >
                <span
                  className={
                    'flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold ' +
                    (isDone
                      ? 'bg-teal text-white'
                      : isCur
                        ? 'bg-pink text-white shadow-[0_0_0_5px_rgba(182,42,92,0.14)]'
                        : 'border border-[#E4DACB] bg-[#F3ECE2] text-neutral-400')
                  }
                >
                  {isDone ? '✓' : no}
                </span>
                <span
                  className={
                    'hidden text-[13px] sm:block ' +
                    (isCur ? 'font-semibold text-ink' : isDone ? 'font-medium text-neutral-800' : 'font-medium text-neutral-400')
                  }
                >
                  {s.label}
                </span>
              </button>
              {showConn ? (
                <span
                  className={
                    'mx-1.5 h-0.5 min-w-[14px] flex-1 ' + (isDone ? 'bg-teal' : 'bg-[#E0D6C7]')
                  }
                />
              ) : null}
            </div>
          );
        })}

        {/* Fixed-width action area so changing the button label / colour /
            which button shows never causes the stages to reflow. */}
        <div className="ml-5 flex w-[186px] shrink-0 justify-end gap-[9px]">
          {/* Always rendered so the cluster keeps an identical width on every
              step — on Step 1 it is hidden (but still occupies its box) and
              made inert, so the stepper band doesn't reflow at the 1 ↔ 2
              transition. */}
          <button
            type="button"
            onClick={onBack}
            disabled={step === 1}
            tabIndex={step === 1 ? -1 : undefined}
            aria-hidden={step === 1 ? true : undefined}
            className={
              'rounded-[9px] border border-border-strong bg-surface px-[15px] py-[9px] text-[13px] font-medium text-ink hover:bg-surface-subtle' +
              (step === 1 ? ' invisible' : '')
            }
          >
            ← Back
          </button>
          {isLast ? (
            submitSlot
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="min-w-[92px] rounded-[9px] border-none bg-teal px-4 py-[9px] text-center text-[13px] font-semibold text-white hover:bg-[#1a6a5d]"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
