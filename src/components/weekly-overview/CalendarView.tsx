'use client';

import {
  CalendarLessonCard,
  NotStartedLessonCard,
} from '@/components/weekly-overview/LessonCard';
import { WEEKDAYS, WEEKDAY_LABELS, todayISO, weekdayOf, type Weekday } from '@/lib/week';
import type { BoardPlan, BoardYear } from '@/types/weekly-overview';

/**
 * Calendar view — the school week laid out as five weekday columns (Mon–Fri),
 * with NO year separations. Each curriculum period maps to a weekday (P1 = Mon …
 * P5 = Fri), so a column stacks every taught year's lesson for that day, top to
 * bottom; the year reads from each card's own "Year N" line. Today's column gets
 * the teal TODAY pill.
 *
 * Lessons render by their own scope, never depending on any classes existing: a
 * covered slot shows its plan card(s) (class / centre / org); an uncovered one
 * shows the "Not started" card, which creates a centre year-group plan on click.
 * The "Everyone / me" owner filter only hides plan cards — it never renumbers.
 */
export function CalendarView({
  years,
  ownerId,
}: {
  years: BoardYear[];
  ownerId: string | null;
}) {
  // Highlight today's weekday column. weekdayOf returns null on weekends, so no
  // column is marked then — correct for a Mon–Fri school week.
  const today = weekdayOf(todayISO());

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-5 items-start gap-[14px]">
        {WEEKDAYS.map((weekday) => (
          <DayHeader key={`head-${weekday}`} weekday={weekday} isToday={weekday === today} />
        ))}
        {WEEKDAYS.map((weekday, i) => (
          <DayColumn key={`col-${weekday}`} period={i + 1} years={years} ownerId={ownerId} />
        ))}
      </div>
    </div>
  );
}

/** A weekday column header — the day label plus a TODAY pill on today's column. */
function DayHeader({ weekday, isToday }: { weekday: Weekday; isToday: boolean }) {
  return (
    <div className="mb-[12px] flex items-center gap-[8px] border-b border-border pb-[10px]">
      <span className="text-[13px] font-bold text-ink">{WEEKDAY_LABELS[weekday]}</span>
      {isToday ? (
        <span className="inline-flex items-center rounded-badge bg-teal px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.05em] text-white">
          Today
        </span>
      ) : null}
    </div>
  );
}

/** One year's lesson for a given weekday/period, with the plans covering it. */
interface Slot {
  year: number;
  lessonKey: string;
  period: number;
  dailyOutcome: string;
  plans: BoardPlan[];
}

/**
 * One weekday column: the matching curriculum period (P1..P5) for every year that
 * has curriculum, stacked top to bottom in year order. A day with no curriculum
 * lesson for any year shows a quiet "+ Plan" placeholder.
 */
function DayColumn({
  period,
  years,
  ownerId,
}: {
  period: number;
  years: BoardYear[];
  ownerId: string | null;
}) {
  const slots: Slot[] = [];
  for (const band of years) {
    const lesson = band.lessons.find((l) => l.period === period);
    if (!lesson) continue;
    slots.push({
      year: band.year,
      lessonKey: lesson.lessonKey,
      period: lesson.period,
      dailyOutcome: lesson.dailyOutcome,
      plans: band.plans.filter((p) => p.lessonKey === lesson.lessonKey),
    });
  }

  if (slots.length === 0) {
    return <EmptyDay />;
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {slots.map((slot) => (
        <PeriodCell key={`${slot.year}-${slot.lessonKey}`} slot={slot} ownerId={ownerId} />
      ))}
    </div>
  );
}

/** A day with no curriculum lesson for any year — a calm "+ Plan" hint. */
function EmptyDay() {
  return (
    <div className="flex items-center justify-center rounded-[12px] border border-dashed border-border-strong px-[13px] py-[16px] text-[11.5px] font-semibold text-text-faint">
      + Plan
    </div>
  );
}

/**
 * One year's slot in a day column: its plan card(s) when covered, or the "Not
 * started" card (which creates a centre year-group plan) when not.
 */
function PeriodCell({ slot, ownerId }: { slot: Slot; ownerId: string | null }) {
  const covered = slot.plans.length > 0;

  if (!covered) {
    return (
      <NotStartedLessonCard
        card={{
          key: `${slot.year}-${slot.lessonKey}`,
          lessonKey: slot.lessonKey,
          year: slot.year,
          period: slot.period,
          weekday: slot.period,
          dailyOutcome: slot.dailyOutcome,
          focusArea: '',
        }}
      />
    );
  }

  const visible = ownerId ? slot.plans.filter((p) => p.owner?.id === ownerId) : slot.plans;

  return (
    <div className="flex flex-col gap-[11px]">
      {visible.map((plan) => (
        <CalendarLessonCard
          key={plan.id}
          card={{
            key: plan.id,
            planId: plan.id,
            year: slot.year,
            period: slot.period,
            status: plan.status,
            scope: plan.scope,
            owner: plan.owner,
            canEdit: plan.canEdit,
            reviewNote: plan.reviewNote,
          }}
        />
      ))}
    </div>
  );
}
