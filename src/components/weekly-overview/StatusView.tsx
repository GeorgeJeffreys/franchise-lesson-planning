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
import { STATUS_COLUMN_ORDER, STATUS_META } from '@/components/weekly-overview/status';
import { CardShell } from '@/components/weekly-overview/CardShell';
import { ScopeChip } from '@/components/weekly-overview/ScopeChip';
import { OwnerAvatar } from '@/components/weekly-overview/OwnerAvatar';
import {
  emptySlotCards,
  periodLabel,
  planCardsForYears,
  type EmptySlotCard,
  type PlanCard,
} from '@/components/weekly-overview/cards';
import { setPlanStatus } from '@/lib/actions/lesson-plan';
import { useScopeChooser } from '@/components/weekly-overview/ScopeChooser';
import type { BoardYear, SlotStatus } from '@/types/weekly-overview';
import type { PlanStatus } from '@/types/lesson';

// How many "Not started" cards to show before collapsing to a "+N more" note.
const NOT_STARTED_CAP = 8;

/**
 * Status view — a five-column kanban (Not started · In progress · Submitted ·
 * Needs Review · Approved). Every plan is a card in its status column (year +
 * period + scope chip + owner); each curriculum slot with no plan of any scope is
 * one "Not started" card.
 *
 * The four real-status columns are a @dnd-kit drag board: dragging a card to
 * another column moves its plan there — optimistically, then persisted via
 * `setPlanStatus` (RLS-scoped) and revalidated, reverting on error. An 8px pointer
 * distance keeps a plain click navigating to the plan. "Not started" is excluded
 * from drag (no plan row → no status) and instead opens the scope chooser.
 */
export function StatusView({ years, ownerId }: { years: BoardYear[]; ownerId: string | null }) {
  const cards = planCardsForYears(years, ownerId);
  const empties = emptySlotCards(years);

  // Optimistic per-plan status overrides, keyed by plan id.
  const [overrides, setOverrides] = useState<Record<string, PlanStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const effectiveStatus = (card: PlanCard): PlanStatus => overrides[card.planId] ?? card.status;

  const byStatus = groupByStatus(cards, effectiveStatus);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const card = active.data.current?.card as PlanCard | undefined;
    if (!card) return;
    const planId = card.planId;

    const target = over.id as PlanStatus;
    const previous = overrides[planId] ?? card.status;
    if (target === previous) return;

    setError(null);
    setOverrides((prev) => ({ ...prev, [planId]: target }));

    setPlanStatus(planId, target)
      .then((res) => {
        if (!res.ok) {
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
          {STATUS_COLUMN_ORDER.map((status) =>
            status === 'not_started' ? (
              <NotStartedColumn key={status} cards={empties} />
            ) : (
              <StatusColumn key={status} status={status} cards={byStatus[status]} />
            ),
          )}
        </div>
      </DndContext>
    </div>
  );
}

function groupByStatus(
  cards: PlanCard[],
  effectiveStatus: (card: PlanCard) => PlanStatus,
): Record<PlanStatus, PlanCard[]> {
  const buckets: Record<PlanStatus, PlanCard[]> = {
    in_progress: [],
    submitted: [],
    needs_review: [],
    approved: [],
  };
  for (const card of cards) buckets[effectiveStatus(card)].push(card);
  return buckets;
}

function ColumnHeader({ status, count }: { status: SlotStatus; count: number }) {
  const meta = STATUS_META[status];
  return (
    <div className={cn('mb-[10px] flex items-center justify-between border-b-2 pb-[8px]', meta.rule)}>
      <span className={cn('inline-flex items-center gap-[6px] text-[12.5px] font-bold', meta.text)}>
        <span aria-hidden>{meta.glyph}</span> {meta.label}
      </span>
      <span className="text-[12px] text-text-faint">{count}</span>
    </div>
  );
}

/** The "Not started" column: capped, never a drop target, cards never draggable. */
function NotStartedColumn({ cards }: { cards: EmptySlotCard[] }) {
  const visible = cards.slice(0, NOT_STARTED_CAP);
  const hidden = cards.length - visible.length;

  return (
    <div>
      <ColumnHeader status="not_started" count={cards.length} />
      <div className="flex flex-col gap-2">
        {visible.map((card) => (
          <NotStartedCard key={card.key} card={card} />
        ))}
        {hidden > 0 ? (
          <div className="py-[6px] text-center text-[11.5px] text-text-faint">+ {hidden} more</div>
        ) : null}
        {cards.length === 0 ? (
          <div className="py-[8px] text-center text-[11.5px] text-text-faint">None</div>
        ) : null}
      </div>
    </div>
  );
}

/** A real-status column: a drop target whose cards are draggable. */
function StatusColumn({ status, cards }: { status: PlanStatus; cards: PlanCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div>
      <ColumnHeader status={status} count={cards.length} />
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
    </div>
  );
}

/** A status card wrapped as a @dnd-kit draggable, still a click-through link. */
function DraggableStatusCard({ card }: { card: PlanCard }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.planId,
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

function StatusCard({ card }: { card: PlanCard }) {
  return (
    <CardShell planId={card.planId} canEdit={card.canEdit}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold text-text-faint">
            Year {card.year} · {periodLabel(card.period)}
          </div>
          <div className="mt-[5px]">
            <ScopeChip scope={card.scope} />
          </div>
        </div>
        {card.owner ? <OwnerAvatar owner={card.owner} size={21} /> : null}
      </div>
    </CardShell>
  );
}

/**
 * A "Not started" card: no plan yet, so it's not a link. The whole card — and its
 * teal "Plan" chip — opens the scope chooser for this curriculum slot.
 */
function NotStartedCard({ card }: { card: EmptySlotCard }) {
  const { openChooser } = useScopeChooser();
  const open = () =>
    openChooser({ lessonKey: card.lessonKey, year: card.year, dailyOutcome: card.dailyOutcome });
  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface-subtle px-[13px] py-[11px] text-left transition-colors hover:bg-surface-cream"
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-text-faint">
          Year {card.year} · {periodLabel(card.period)}
        </div>
        {card.dailyOutcome ? (
          <div className="mt-[3px] line-clamp-1 text-[12.5px] font-medium text-neutral-700">
            {card.dailyOutcome}
          </div>
        ) : null}
      </div>
      <span className="inline-flex flex-shrink-0 items-center gap-[4px] rounded-badge border border-teal-tint-border bg-teal-tint px-[8px] py-[4px] text-[10.5px] font-bold text-teal">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1F7A6C" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Plan
      </span>
    </button>
  );
}
