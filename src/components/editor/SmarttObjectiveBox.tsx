'use client';

import { OBJECTIVE_STEM, SMARTT_CRITERIA } from '@/lib/editor/objective';

interface SmarttObjectiveBoxProps {
  /** The teacher-editable remainder (the part after the enforced stem). */
  remainder: string;
  onChange: (remainder: string) => void;
}

/**
 * The pink SMARTT box — the single home of the objective. The opening stem is
 * fixed and shown as muted text; the teacher only edits the remainder. The six
 * SMARTT criteria are shown as guidance chips. The "Check my objective" AI
 * affordance is rendered per the design but left un-wired (a later slice).
 */
export function SmarttObjectiveBox({ remainder, onChange }: SmarttObjectiveBoxProps) {
  return (
    <div className="mt-[18px] rounded-lg border border-status-review-border bg-status-review-bg px-[18px] py-4">
      <div className="mb-[11px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-[10px]">
          <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-pink">
            SMARTT objective
          </span>
          <span className="text-[12px] text-pink/60">
            the one target for this lesson — set it here
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SMARTT_CRITERIA.map((c) => (
            <span
              key={c.label}
              title={c.description}
              className="cursor-help rounded-full border border-border bg-surface px-[9px] py-[3px] text-[11px] font-medium text-neutral-700"
            >
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-[14px] rounded-md border border-border bg-surface px-[17px] py-[15px]">
        <div className="flex-1">
          <span className="text-[15px] leading-[1.5] text-neutral-400">{OBJECTIVE_STEM}</span>{' '}
          <textarea
            rows={2}
            value={remainder}
            onChange={(e) => onChange(e.target.value)}
            placeholder="read a short café menu and identify five familiar food words."
            aria-label="SMARTT objective"
            className="mt-1 w-full resize-y bg-transparent font-sans text-[15px] font-medium leading-[1.5] text-neutral-900 placeholder:font-normal placeholder:text-neutral-400 outline-none"
          />
        </div>
        <button
          type="button"
          disabled
          title="AI objective check — coming in a later slice"
          className="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-sm border border-status-submitted-border bg-status-submitted-bg px-[13px] py-[9px] text-[13px] font-semibold text-teal opacity-60"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
          </svg>
          Check my objective
        </button>
      </div>
    </div>
  );
}
