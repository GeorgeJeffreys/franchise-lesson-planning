'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/cn';
import {
  STATUS_COLUMN_ORDER,
  STATUS_META,
} from '@/components/weekly-overview/status';
import { CardShell } from '@/components/weekly-overview/CardShell';
import { allCards, timeLabel, type LessonCard } from '@/components/weekly-overview/cards';
import { setPlanStatus } from '@/lib/actions/lesson-plan';
import type { ClassWeek, SlotStatus } from '@/types/weekly-overview';
import type { PlanStatus } from '@/types/lesson';

// How many "Not started" cards to show before collapsing to a "+N more" note —
// every unplanned class/day lands here, so it can grow large.
const NOT_STARTED_CAP = 8;

/**
 * Status view — a five-column kanban (Not started · In progress · Submitted ·
 * Needs Review · Approved). Cards mirror the calendar cards (day + date · time,
 * then class); planned cards open the editor on a plain click.
 *
 * The four real-status columns are a @dnd-kit drag board: dragging a card to
 * another column moves its plan to that column's status — optimistically, then
 * persisted via `setPlanStatus` (RLS-scoped) and revalidated, reverting on error.
 * A `PointerSensor` distance constraint (8px) keeps a plain click navigating to
 * the editor and only starts a move on real movement. The "Not started" column
 * is excluded from drag entirely (no plan row → no status to set).
 */
export function StatusView({ classes }: { classes: ClassWeek[] }) {
  const cards = allCards(classes);

  // Optimistic per-plan status overrides, keyed by plan id. The effective status
  // of a card is its override if present, else the server value. Overrides agree
  // with the server once the post-update revalidation flows fresh props back in.
  const [overrides, setOverrides] = useState<Record<string, PlanStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const effectiveStatus = (card: LessonCard): SlotStatus =>
    card.planId && overrides[card.planId] ? overrides[card.planId] : card.status;

  const byStatus = groupByStatus(cards, effectiveStatus);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const card = active.data.current?.card as LessonCard | undefined;
    const planId = card?.planId;
    if (!card || !planId) return;

    const target = over.id as PlanStatus;
    const previous = (overrides[planId] ?? card.status) as PlanStatus;
    if (target === previous) return;

    setError(null);
    setOverrides((prev) => ({ ...prev, [planId]: target }));

    setPlanStatus(planId, target)
      .then((res) => {
        if (!res.ok) {
          // Revert the optimistic move and surface the reason.
          setOverrides((prev) => ({ ...prev, [planId]: previous }));
          setError(res.error ?? 'Could not update status.');
        }
      })
      .catch(() => {
        setOverrides((prev) => ({ ...prev, [planId]: previous }));
        setError('Could not update status.');
      });
  };

  return (
    <div>
      {error ? (
        <div className="mb-[12px] rounded-[10px] border border-status-review-bg bg-status-review-bg px-[12px] py-[8px] text-[12.5px] text-status-review">
          {error}
        </div>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-5 items-start gap-[14px]">
          {STATUS_COLUMN_ORDER.map((status) => (
            <StatusColumn key={status} status={status} cards={byStatus[status]} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function groupByStatus(
  cards: LessonCard[],
  effectiveStatus: (card: LessonCard) => SlotStatus,
): Record<SlotStatus, LessonCard[]> {
  const buckets: Record<SlotStatus, LessonCard[]> = {
    not_started: [],
    in_progress: [],
    submitted: [],
    needs_review: [],
    approved: [],
  };
  for (const card of cards) {
    buckets[effectiveStatus(card)].push(card);
  }
  return buckets;
}

function StatusColumn({ status, cards }: { status: SlotStatus; cards: LessonCard[] }) {
  const meta = STATUS_META[status];

  return (
    <div>
      <div
        className={cn(
          'mb-[10px] flex items-center justify-between border-b-2 pb-[8px]',
          meta.rule,
        )}
      >
        <span className={cn('inline-flex items-center gap-[6px] text-[12.5px] font-bold', meta.text)}>
          <span aria-hidden>{meta.glyph}</span> {meta.label}
        </span>
        <span className="text-[12px] text-text-faint">{cards.length}</span>
      </div>

      {status === 'not_started' ? (
        <NotStartedBody cards={cards} />
      ) : (
        <DroppableBody status={status} cards={cards} />
      )}
    </div>
  );
}

/** The "Not started" column: capped, never a drop target, cards never draggable. */
function NotStartedBody({ cards }: { cards: LessonCard[] }) {
  const visible = cards.slice(0, NOT_STARTED_CAP);
  const hidden = cards.length - visible.length;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((card) => (
        <StatusCard key={card.key} card={card} />
      ))}
      {hidden > 0 ? (
        <div className="py-[6px] text-center text-[11.5px] text-text-faint">
          + {hidden} more
        </div>
      ) : null}
      {cards.length === 0 ? (
        <div className="py-[8px] text-center text-[11.5px] text-text-faint">None</div>
      ) : null}
    </div>
  );
}

/** A real-status column: a drop target whose cards are draggable. */
function DroppableBody({ status, cards }: { status: PlanStatus; cards: LessonCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[64px] flex-col gap-2 rounded-[10px] transition-colors',
        isOver && 'bg-surface-subtle ring-2 ring-inset ring-border',
      )}
    >
      {cards.map((card) => (
        <DraggableStatusCard key={card.key} card={card} />
      ))}
      {cards.length === 0 ? (
        <div className="py-[8px] text-center text-[11.5px] text-text-faint">None</div>
      ) : null}
    </div>
  );
}

/** A status card wrapped as a @dnd-kit draggable, still a click-through link. */
function DraggableStatusCard({ card }: { card: LessonCard }) {
  // A real-status card always has a plan id. We spread only `listeners` (pointer
  // drag), not `attributes`: that would add a second focusable `role="button"`
  // around the card's own link, and there's no keyboard sensor to back it.
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.planId as string,
    data: { card },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      className={cn('cursor-grab', isDragging && 'cursor-grabbing opacity-80')}
    >
      <StatusCard card={card} />
    </div>
  );
}

function StatusCard({ card }: { card: LessonCard }) {
  const time = card.period == null ? '' : ` · ${timeLabel(card.period)}`;
  return (
    <CardShell planId={card.planId}>
      <div className="text-[11.5px] font-semibold text-text-faint">
        {card.dayLabel} {card.dateNum}
        {time}
      </div>
      <div className="mt-[3px] text-[14px] font-semibold">{card.classLabel}</div>
    </CardShell>
  );
}
