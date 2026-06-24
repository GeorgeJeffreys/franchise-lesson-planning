'use client';

import { cn } from '@/lib/cn';
import { StatusChip } from '@/components/weekly-overview/StatusChip';
import { ScopeChip } from '@/components/weekly-overview/ScopeChip';
import { CardShell } from '@/components/weekly-overview/CardShell';
import { OwnerAvatar } from '@/components/weekly-overview/OwnerAvatar';
import { periodLabel } from '@/components/weekly-overview/cards';
import { useScopeChooser } from '@/components/weekly-overview/ScopeChooser';
import type { BoardSlot, BoardYear, SlotPlan } from '@/types/weekly-overview';

// P1..P5 map onto the school week Mon–Fri (the period proxy the old design used).
const PERIOD_WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/**
 * Calendar view — one band per year the teacher teaches, each a row of curriculum
 * period columns (P1..P5). Every plan covering a slot renders as a card (status +
 * scope chip + owner); a slot with no plan of any scope shows a single "+ Plan"
 * card that opens the scope chooser. A covered slot also offers "+ make your own"
 * so a teacher can add a class plan alongside a shared centre/org one.
 */
export function CalendarView({
  years,
  ownerId,
}: {
  years: BoardYear[];
  ownerId: string | null;
}) {
  return (
    <div className="flex flex-col gap-[26px]">
      {years.map((band) => (
        <div key={band.year}>
          <h2 className="mb-[12px] text-[15px] font-bold text-ink">Year {band.year}</h2>
          {band.slots.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border-strong px-[14px] py-[14px] text-[12.5px] text-text-muted">
              No curriculum lessons for Year {band.year} this week.
            </div>
          ) : (
            <div
              className="grid items-start gap-[14px]"
              style={{ gridTemplateColumns: `repeat(${band.slots.length}, minmax(0, 1fr))` }}
            >
              {band.slots.map((slot) => (
                <PeriodColumn key={slot.lessonKey} slot={slot} ownerId={ownerId} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PeriodColumn({ slot, ownerId }: { slot: BoardSlot; ownerId: string | null }) {
  const { openChooser } = useScopeChooser();
  const visible = ownerId ? slot.plans.filter((p) => p.owner?.id === ownerId) : slot.plans;
  const covered = slot.plans.length > 0;
  const weekday = PERIOD_WEEKDAY[slot.period - 1] ?? '';

  const open = () =>
    openChooser({ lessonKey: slot.lessonKey, year: slot.year, dailyOutcome: slot.dailyOutcome });

  return (
    <div className="flex flex-col gap-[11px]">
      <div className="flex items-baseline gap-[7px] border-b-2 border-neutral-200 px-[2px] pb-[10px]">
        <span className="text-[14px] font-bold text-ink">Period {slot.period}</span>
        {weekday ? <span className="text-[11.5px] text-text-faint">{weekday}</span> : null}
      </div>

      {slot.dailyOutcome ? (
        <p className="line-clamp-2 px-[2px] text-[11.5px] leading-[1.45] text-text-muted">
          {slot.dailyOutcome}
        </p>
      ) : null}

      {!covered ? (
        <PlanAffordance onClick={open} variant="empty" />
      ) : (
        <>
          {visible.map((plan) => (
            <CalendarCard key={plan.id} plan={plan} period={slot.period} />
          ))}
          <PlanAffordance onClick={open} variant="add" />
        </>
      )}
    </div>
  );
}

function CalendarCard({ plan, period }: { plan: SlotPlan; period: number }) {
  return (
    <CardShell planId={plan.id} canEdit={plan.canEdit}>
      <div className="text-[11.5px] font-semibold text-text-faint">{periodLabel(period)}</div>
      <div className="mb-[9px] mt-[5px] flex flex-wrap items-center gap-[6px]">
        <StatusChip status={plan.status} />
        <ScopeChip scope={plan.scope} />
      </div>
      <div className="flex items-center justify-end">
        {plan.owner ? <OwnerAvatar owner={plan.owner} /> : null}
      </div>
    </CardShell>
  );
}

/** The "+ Plan" (empty slot) and "+ make your own" (covered slot) affordances. */
function PlanAffordance({ onClick, variant }: { onClick: () => void; variant: 'empty' | 'add' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-[6px] rounded-[13px] border-[1.5px] border-dashed border-border-strong text-[12.5px] font-semibold text-teal transition-colors hover:bg-surface-subtle',
        variant === 'empty' ? 'px-[14px] py-[16px]' : 'px-[10px] py-[9px]',
      )}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1F7A6C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
      {variant === 'empty' ? 'Plan' : 'Make your own'}
    </button>
  );
}
