'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/cn';
import { CalendarLessonCard } from '@/components/weekly-overview/LessonCard';
import { useScopeChooser } from '@/components/weekly-overview/ScopeChooser';
import type { PlanCard } from '@/components/weekly-overview/cards';
import { WEEKDAYS, WEEKDAY_LABELS, todayISO, weekdayOf } from '@/lib/week';
import { reorderPlans, type PlanPlacement } from '@/lib/actions/lesson-plan';
import type { BoardLesson, BoardPlan, BoardYear } from '@/types/weekly-overview';

// The five Mon–Fri columns as 1..5 weekday numbers, paired with their stable key.
const COLUMNS = WEEKDAYS.map((key, i) => ({ key, weekday: i + 1 }));

/**
 * Calendar view — the day-column weekly board. Each year the teacher teaches is a
 * section of five weekday columns (Mon–Fri); a column is a vertical stack of its
 * lesson cards, and a card's "Period N" is its 1-based position in that stack
 * (top = Period 1), re-derived live so it stays correct as cards are dragged.
 *
 * Teachers add a lesson from the column's "+ Add lesson" picker (the week's
 * curriculum lessons for that year); the first added to a day is Period 1, the
 * next Period 2, and so on. Cards can be dragged to reorder within a day or move
 * to another day — only your own cards are draggable (RLS blocks writing others');
 * shared centre/org cards sort into the column by their creator's placement.
 *
 * The owner filter and drag are mutually exclusive: while a specific person is
 * filtered in, the stack is a read view (numbers still reflect the full merged
 * order) and dragging is disabled — it resumes under "Everyone".
 */
export function CalendarView({
  years,
  ownerId,
}: {
  years: BoardYear[];
  ownerId: string | null;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      {years.map((band) => (
        <YearBoard key={band.year} band={band} ownerId={ownerId} />
      ))}
    </div>
  );
}

type ByDay = Record<number, BoardPlan[]>;

/** Group a year's plans into Mon–Fri columns, preserving the loaded sort order. */
function groupByDay(plans: BoardPlan[]): ByDay {
  const byDay: ByDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const p of plans) {
    const w = Math.min(5, Math.max(1, Math.trunc(p.weekday)));
    byDay[w].push(p);
  }
  return byDay;
}

/** A shallow clone so optimistic edits never mutate the previous (revert) state. */
function cloneByDay(byDay: ByDay): ByDay {
  return {
    1: byDay[1].map((p) => ({ ...p })),
    2: byDay[2].map((p) => ({ ...p })),
    3: byDay[3].map((p) => ({ ...p })),
    4: byDay[4].map((p) => ({ ...p })),
    5: byDay[5].map((p) => ({ ...p })),
  };
}

function findWeekday(byDay: ByDay, id: string): number | null {
  for (const w of [1, 2, 3, 4, 5]) {
    if (byDay[w].some((p) => p.id === id)) return w;
  }
  return null;
}

function toPlanCard(plan: BoardPlan, period: number): PlanCard {
  return {
    key: plan.id,
    planId: plan.id,
    year: plan.year,
    period,
    status: plan.status,
    scope: plan.scope,
    owner: plan.owner,
    canEdit: plan.canEdit,
    reviewNote: plan.reviewNote,
  };
}

/** One year section: its heading and the five draggable weekday columns. */
function YearBoard({ band, ownerId }: { band: BoardYear; ownerId: string | null }) {
  const { openChooser, openAdd } = useScopeChooser();
  const [byDay, setByDay] = useState<ByDay>(() => groupByDay(band.plans));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-sync to server truth whenever the loaded plans change (navigation / a
  // revalidate after create or reorder hands back a fresh array). Reset during
  // render — not in an effect — so optimistic state never lingers a frame.
  const [loadedPlans, setLoadedPlans] = useState(band.plans);
  if (loadedPlans !== band.plans) {
    setLoadedPlans(band.plans);
    setByDay(groupByDay(band.plans));
  }

  const today = weekdayOf(todayISO());
  const dragEnabled = ownerId === null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Lessons not yet on the board anywhere this year — the "+ Add lesson" pool.
  const placedKeys = useMemo(
    () => new Set([...byDay[1], ...byDay[2], ...byDay[3], ...byDay[4], ...byDay[5]].map((p) => p.lessonKey)),
    [byDay],
  );
  const unplacedLessons: BoardLesson[] = band.lessons.filter((l) => !placedKeys.has(l.lessonKey));

  const activePlan = activeId
    ? [byDay[1], byDay[2], byDay[3], byDay[4], byDay[5]].flat().find((p) => p.id === activeId) ?? null
    : null;
  // The dragged card's current position (for the drag overlay's "Period N").
  const activePeriod =
    activePlan != null ? byDay[activePlan.weekday].findIndex((p) => p.id === activePlan.id) + 1 : 0;

  const onDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeKey = active.id as string;
    const overKey = over.id as string;

    const sourceDay = findWeekday(byDay, activeKey);
    if (sourceDay == null) return;

    let targetDay: number;
    let overIndex: number;
    if (overKey.startsWith('day-')) {
      targetDay = Number(overKey.slice(4));
      overIndex = byDay[targetDay].length;
    } else {
      const d = findWeekday(byDay, overKey);
      if (d == null) return;
      targetDay = d;
      overIndex = byDay[targetDay].findIndex((p) => p.id === overKey);
    }

    const prev = byDay;
    const next = cloneByDay(prev);

    if (sourceDay === targetDay) {
      const arr = next[sourceDay];
      const oldIndex = arr.findIndex((p) => p.id === activeKey);
      const newIndex = overKey.startsWith('day-') ? arr.length - 1 : overIndex;
      if (oldIndex === newIndex || newIndex < 0) return; // dropped in place
      next[sourceDay] = arrayMove(arr, oldIndex, newIndex);
    } else {
      const fromArr = next[sourceDay];
      const fromIdx = fromArr.findIndex((p) => p.id === activeKey);
      const [moved] = fromArr.splice(fromIdx, 1);
      moved.weekday = targetDay;
      const insertAt = overKey.startsWith('day-') ? next[targetDay].length : Math.max(0, overIndex);
      next[targetDay].splice(insertAt, 0, moved);
    }

    // Renumber the affected columns 1..N and collect the writes — only OWN cards
    // (RLS blocks the rest; shared cards keep their stored placement).
    const affected = sourceDay === targetDay ? [sourceDay] : [sourceDay, targetDay];
    const updates: PlanPlacement[] = [];
    for (const day of affected) {
      next[day].forEach((p, i) => {
        p.period = i + 1;
        if (p.canEdit) updates.push({ id: p.id, weekday: day, period: i + 1 });
      });
    }

    setError(null);
    setByDay(next);
    reorderPlans(updates)
      .then((res) => {
        if (!res.ok) {
          setByDay(prev);
          setError(res.error ?? 'Could not move the lesson.');
        }
      })
      .catch(() => {
        setByDay(prev);
        setError('Could not move the lesson.');
      });
  };

  const columns = (
    <div className="grid min-w-[900px] grid-cols-5 items-start gap-[14px]">
      {COLUMNS.map(({ key, weekday }) => (
        <DayColumn
          key={key}
          weekday={weekday}
          isToday={key === today}
          cards={byDay[weekday]}
          ownerId={ownerId}
          dragEnabled={dragEnabled}
          onAddLesson={() =>
            openAdd({
              year: band.year,
              weekday,
              period: byDay[weekday].length + 1,
              lessons: unplacedLessons,
            })
          }
          onMakeYourOwn={(plan) =>
            openChooser({
              lessonKey: plan.lessonKey,
              year: plan.year,
              dailyOutcome: plan.dailyOutcome,
              weekday,
              period: byDay[weekday].length + 1,
            })
          }
        />
      ))}
    </div>
  );

  return (
    <section>
      <h2 className="mb-[12px] text-[15px] font-bold text-ink">Year {band.year}</h2>
      {error ? (
        <div className="mb-[12px] rounded-[10px] border border-status-review-bg bg-status-review-bg px-[12px] py-[8px] text-[12.5px] text-status-review">
          {error}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        {/* The DndContext is always mounted so the columns' sortable/droppable
            hooks have a provider; under the owner filter every card is `disabled`
            (see SortableCard), so no drag can start until "Everyone" is back. */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {columns}
          <DragOverlay>
            {activePlan ? <CalendarLessonCard card={toPlanCard(activePlan, activePeriod)} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </section>
  );
}

/** A weekday column: header, the day's card stack, and "+ Add lesson". */
function DayColumn({
  weekday,
  isToday,
  cards,
  ownerId,
  dragEnabled,
  onAddLesson,
  onMakeYourOwn,
}: {
  weekday: number;
  isToday: boolean;
  cards: BoardPlan[];
  ownerId: string | null;
  dragEnabled: boolean;
  onAddLesson: () => void;
  onMakeYourOwn: (plan: BoardPlan) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${weekday}` });
  const label = WEEKDAY_LABELS[WEEKDAYS[weekday - 1]];

  // Period N is the 1-based position in the FULL stack, so numbers stay stable
  // under the owner filter (which only hides cards, never renumbers). The sortable
  // items list is the RENDERED subset so it never references a missing node.
  const visible = cards
    .map((plan, i) => ({ plan, period: i + 1 }))
    .filter(({ plan }) => (ownerId ? plan.owner?.id === ownerId : true));
  const items = visible.map(({ plan }) => plan.id);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-[12px] flex items-center gap-[8px] border-b border-border pb-[10px]">
        <span className="text-[13px] font-bold text-ink">{label}</span>
        {isToday ? (
          <span className="inline-flex items-center rounded-badge bg-teal px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.05em] text-white">
            Today
          </span>
        ) : null}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[60px] flex-col gap-[11px] rounded-[10px] transition-colors',
          isOver && 'bg-surface-subtle ring-2 ring-inset ring-border',
        )}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {visible.map(({ plan, period }) => (
            <SortableCard
              key={plan.id}
              plan={plan}
              period={period}
              dragEnabled={dragEnabled}
              onMakeYourOwn={() => onMakeYourOwn(plan)}
            />
          ))}
        </SortableContext>

        <button
          type="button"
          onClick={onAddLesson}
          className="inline-flex items-center justify-center gap-[5px] rounded-[10px] border border-dashed border-border-strong px-[12px] py-[10px] text-[11.5px] font-semibold text-text-muted transition-colors hover:border-teal hover:text-teal"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add lesson
        </button>
      </div>
    </div>
  );
}

/**
 * One draggable card. Dragging is enabled only for cards the viewer may edit (and
 * only under "Everyone"); a shared centre/org card stays put but still sorts into
 * the column, and offers "+ make your own" to add your own class plan alongside.
 */
function SortableCard({
  plan,
  period,
  dragEnabled,
  onMakeYourOwn,
}: {
  plan: BoardPlan;
  period: number;
  dragEnabled: boolean;
  onMakeYourOwn: () => void;
}) {
  const disabled = !dragEnabled || !plan.canEdit;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  const shared = plan.scope !== 'class';

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-[6px]">
      <div {...attributes} {...listeners} className={disabled ? undefined : 'cursor-grab'}>
        <CalendarLessonCard card={toPlanCard(plan, period)} />
      </div>
      {shared ? (
        <button
          type="button"
          onClick={onMakeYourOwn}
          className="inline-flex items-center gap-[5px] self-start text-[11.5px] font-semibold text-teal transition-colors hover:text-teal-deep"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Make your own
        </button>
      ) : null}
    </div>
  );
}
