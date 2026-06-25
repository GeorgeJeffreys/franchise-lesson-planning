'use client';

// The restored lesson card — verbatim from the pre-reinvention board (commit
// 5b60faf, "Restore the previous lesson card as the per-slot board unit"):
//   • CardShell chrome (white, 1px border, 12px radius, inline pending spinner)
//   • the Calendar variant: time line · class line · status badge + scope chip + owner
//   • the Status variant:   time line · class line · scope chip, owner on the right
//   • the "Not started" variant: faint line · class line + teal "Plan" chip
//
// The ONLY changes from the old card are the data bindings the new model forces —
// class line → "Year N" (never an A/B group label); time line → the day-ordinal
// "Period #" (re-derived from the day's stack) — and the small scope chip. Nothing
// is restyled.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CardShell } from '@/components/weekly-overview/CardShell';
import { StatusChip } from '@/components/weekly-overview/StatusChip';
import { ScopeChip } from '@/components/weekly-overview/ScopeChip';
import { OwnerAvatar } from '@/components/weekly-overview/OwnerAvatar';
import { periodLabel, type EmptySlotCard, type PlanCard } from '@/components/weekly-overview/cards';
import { createScopedPlan } from '@/lib/actions/create-lesson';

/**
 * Calendar-view planned card — restored CalendarCard (status badge + scope chip).
 * The chip is shown only for non-centre scopes: centre year-group is the default,
 * so its tag would be noise on every card.
 */
export function CalendarLessonCard({ card }: { card: PlanCard }) {
  return (
    <CardShell planId={card.planId} canEdit={card.canEdit}>
      <div className="text-[11.5px] font-semibold text-text-faint">{periodLabel(card.period)}</div>
      <div className="mb-[9px] mt-[3px] text-[14px] font-semibold">Year {card.year}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-[6px]">
          <StatusChip status={card.status} />
          {card.scope !== 'centre' ? <ScopeChip scope={card.scope} /> : null}
        </div>
        {card.owner ? <OwnerAvatar owner={card.owner} /> : null}
      </div>
    </CardShell>
  );
}

/** Status-view planned card — restored StatusCard. Centre tag omitted (the default). */
export function StatusLessonCard({ card }: { card: PlanCard }) {
  return (
    <CardShell planId={card.planId} canEdit={card.canEdit}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold text-text-faint">{periodLabel(card.period)}</div>
          <div className="mt-[3px] text-[14px] font-semibold">Year {card.year}</div>
          {card.scope !== 'centre' ? (
            <div className="mt-[6px]">
              <ScopeChip scope={card.scope} />
            </div>
          ) : null}
        </div>
        {card.owner ? <OwnerAvatar owner={card.owner} size={21} /> : null}
      </div>
    </CardShell>
  );
}

/**
 * The "Not started" card — no plan yet, so it's a button. Clicking it creates a
 * centre year-group plan for this curriculum lesson (defaulted onto its natural
 * day) and takes the teacher straight into the editor — no "who for" step. The
 * card's year is the only thing it asks for, and that is fixed by which slot it is.
 */
export function NotStartedLessonCard({ card }: { card: EmptySlotCard }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await createScopedPlan({
      lessonKey: card.lessonKey,
      scope: 'centre',
      weekday: card.weekday,
      period: card.period,
    });
    if (res.ok) {
      router.push(`/plan/${res.planId}`);
      return; // keep the busy state through the navigation
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      title={error ?? undefined}
      className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface-subtle px-[13px] py-[11px] text-left transition-colors hover:bg-surface-cream disabled:opacity-60"
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-text-faint">{periodLabel(card.period)}</div>
        <div className="mt-[2px] text-[14px] font-semibold">Year {card.year}</div>
        {error ? <div className="mt-[3px] text-[10.5px] font-medium text-status-review">{error}</div> : null}
      </div>
      <span className="inline-flex flex-shrink-0 items-center gap-[4px] rounded-badge border border-teal-tint-border bg-teal-tint px-[8px] py-[4px] text-[10.5px] font-bold text-teal">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1F7A6C" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {busy ? 'Starting…' : 'Plan'}
      </span>
    </button>
  );
}
