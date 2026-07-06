'use client';

// The per-column "+ Add lesson" affordance. Clicking a day column already fixes
// the period (the column = a curriculum period), the month and the week, so the
// curriculum lesson is fully determined once a band is chosen — no need for the
// full NEW LESSON popup with its period-card picker.
//
// The choices are the teacher's OWN bands (the subject·year spaces on their board),
// each resolved to this column's curriculum lesson. Only bands that actually have a
// lesson for this slot are plannable; the rest carry a null `lessonKey` and are
// dropped here rather than shown as dead "No lesson" rows. From the plannable set:
//   • none      → one quiet line, no add affordance;
//   • exactly 1 → the button creates that lesson directly, no intermediate menu;
//   • 2 or more → a short, clean menu of full "Subject · Year" labels.
//
// The menu opens inline (in the column's flow) rather than as an absolute overlay:
// the board scrolls horizontally (`overflow-x-auto`), which makes vertical overflow
// a scroll/clip boundary, so an absolutely-positioned dropdown from the bottom-of-
// column button would be clipped. An inline panel grows the column instead.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { createScopedPlan } from '@/lib/actions/create-lesson';
import { usePlanHref } from '@/components/weekly-overview/BoardReturn';
import { formatNumber } from '@/lib/format';

/** One band offered for this column, resolved to its curriculum lesson. */
export interface AddYearChoice {
  /** Stable band identity (`centreId|subjectCode|year`) — the choice key. */
  bandKey: string;
  year: number;
  /** The subject this choice creates against (board can span subjects). */
  subjectName: string;
  /** The centre to create against; label shown only when the board spans centres. */
  centreId: string;
  centreName: string | null;
  /** The lesson for this (band, period), or null when the curriculum has none. */
  lessonKey: string | null;
  /** The day-ordinal sort hint to write (next in this band's stack for the column). */
  period: number;
}

/** The dashed "+ Add lesson" trigger, styled the same whether it opens a menu or
 *  creates directly. `active` tints it (menu open); `busy` dims it (creating). */
function AddButton({
  active,
  busy,
  label,
  onClick,
  ...aria
}: {
  active?: boolean;
  busy?: boolean;
  label: string;
  onClick: () => void;
} & React.AriaAttributes) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'inline-flex items-center justify-center gap-[5px] rounded-[10px] border border-dashed px-[12px] py-[10px] text-[11.5px] font-semibold transition-colors',
        active
          ? 'border-teal text-teal'
          : 'border-border-strong text-text-muted hover:border-teal hover:text-teal',
        busy && 'cursor-not-allowed opacity-60',
      )}
      {...aria}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}

export function AddLessonMenu({
  weekday,
  choices,
  spansMultipleSubjects,
}: {
  /** The Mon–Fri column (1..5) — also the curriculum period the lessons resolve to. */
  weekday: number;
  /** The teacher's bands, each resolved to this column's curriculum lesson. */
  choices: AddYearChoice[];
  /** Whether the board spans subjects — decides "Year N" vs "Subject · Year N" labels. */
  spansMultipleSubjects: boolean;
}) {
  const t = useTranslations('board');
  const locale = useLocale();
  const router = useRouter();
  const planHref = usePlanHref();
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only bands with a real curriculum lesson for this slot can be planned; the rest
  // are dropped so the picker never shows a dead "No lesson" row.
  const plannable = choices.filter((c) => c.lessonKey);
  const busy = busyKey !== null;

  const choose = async (choice: AddYearChoice) => {
    if (!choice.lessonKey || busy) return;
    setBusyKey(choice.bandKey);
    setError(null);
    // Whole-centre scope: the column fixes the period/day, month and week, and the
    // slot names its own centre; the create action resolves subject/year server-side
    // from the locked key and creates against the passed centre.
    const res = await createScopedPlan({
      lessonKey: choice.lessonKey,
      scope: 'centre',
      schoolId: choice.centreId,
      weekday,
      period: choice.period,
    });
    if (res.ok) {
      // Carry the current week so the new plan's "back to overview" returns here.
      router.push(planHref(`/plan/${res.planId}`));
      return; // keep the affordance up through the navigation
    }
    setError(res.error);
    setBusyKey(null);
  };

  const labelFor = (c: AddYearChoice): string => {
    const yearLabel = t('card.year', { n: formatNumber(c.year, locale) });
    return spansMultipleSubjects ? `${c.subjectName} · ${yearLabel}` : yearLabel;
  };

  // None plannable → one quiet line, no add affordance and no dead rows.
  if (plannable.length === 0) {
    return (
      <p className="px-[4px] py-[8px] text-[11.5px] leading-[1.4] text-text-faint">
        {t('add.noCurriculum')}
      </p>
    );
  }

  // Exactly one plannable band → skip the menu; the button creates it directly.
  if (plannable.length === 1) {
    const only = plannable[0];
    return (
      <div className="flex flex-col gap-[8px]">
        <AddButton
          busy={busy}
          label={busy ? t('add.opening') : t('addLesson')}
          onClick={() => choose(only)}
        />
        {error ? (
          <p className="rounded-[7px] bg-status-review-bg px-[9px] py-[6px] text-[11.5px] text-status-review">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // Two or more → a short, clean menu of full "Subject · Year" labels.
  return (
    <div className="flex flex-col gap-[8px]">
      <AddButton
        active={open}
        label={t('addLesson')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />

      {open ? (
        <div className="rounded-[10px] border border-border bg-surface p-[5px] shadow-[0_10px_28px_-14px_rgba(0,0,0,0.4)]">
          <div className="px-[9px] pb-[4px] pt-[5px] text-[10px] font-bold uppercase tracking-[0.05em] text-text-faint">
            {spansMultipleSubjects ? t('add.choose') : t('add.chooseYear')}
          </div>
          {plannable.map((c) => {
            const rowBusy = busyKey === c.bandKey;
            return (
              <button
                key={c.bandKey}
                type="button"
                onClick={() => choose(c)}
                disabled={busy}
                className={cn(
                  'flex w-full items-center justify-between gap-[8px] rounded-[8px] px-[9px] py-[8px] text-start text-[12.5px] font-semibold transition-colors',
                  busy
                    ? 'cursor-not-allowed text-text-faint'
                    : 'text-ink hover:bg-teal-tint hover:text-teal-deep',
                )}
              >
                <span dir="auto">
                  {labelFor(c)}
                  {c.centreName ? (
                    <span className="font-normal text-text-faint"> · {c.centreName}</span>
                  ) : null}
                </span>
                {rowBusy ? (
                  <span className="text-[11px] font-medium text-text-muted">{t('add.opening')}</span>
                ) : null}
              </button>
            );
          })}

          {error ? (
            <p className="mx-[5px] mb-[4px] mt-[3px] rounded-[7px] bg-status-review-bg px-[9px] py-[6px] text-[11.5px] text-status-review">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
