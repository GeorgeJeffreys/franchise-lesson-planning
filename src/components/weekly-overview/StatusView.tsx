'use client';

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { STATUS_COLUMN_ORDER } from '@/components/weekly-overview/status';
import { StatusDot } from '@/components/weekly-overview/StatusDot';
import { StatusLessonCard } from '@/components/weekly-overview/LessonCard';
import { NotStartedGroups } from '@/components/weekly-overview/NotStartedGroups';
import {
  emptySlotCards,
  planCardsForYears,
  type EmptySlotCard,
  type PlanCard,
} from '@/components/weekly-overview/cards';
import { setPlanStatus, submitLessonPlanById } from '@/lib/actions/lesson-plan';
import { SubmitForApprovalModal } from '@/components/weekly-overview/SubmitForApprovalModal';
import type { BoardYear, SlotStatus } from '@/types/weekly-overview';
import type { PlanStatus } from '@/types/lesson';

/** A move into "Submitted" held pending the confirm modal (nothing written yet). */
interface PendingSubmit {
  card: PlanCard;
  /** The column the card came from, to roll back to on cancel/failure. */
  from: PlanStatus;
}

/** A board error, optionally carrying a plan to link to (the submit-failure case). */
interface BoardError {
  text: string;
  /** When set, the toast offers an "Open the plan" link to fix it in the editor. */
  planId: string | null;
}

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
// The four real-status columns, left → right — the coordinator (read-only) board
// omits the "Not started" pseudo-column (no roster computation in this slice).
const REAL_STATUS_COLUMNS: PlanStatus[] = ['in_progress', 'submitted', 'needs_review', 'approved'];

export function StatusView({
  years,
  ownerId,
  readOnly = false,
  spansMultipleCentres = false,
}: {
  years: BoardYear[];
  ownerId: string | null;
  /** Coordinator review mode: no drag, and the "Not started" column is omitted. */
  readOnly?: boolean;
  /** Board spans >1 centre — "Not started" cards carry their centre label. */
  spansMultipleCentres?: boolean;
}) {
  const t = useTranslations('board');
  const cards = planCardsForYears(years, ownerId);
  const empties = emptySlotCards(years, spansMultipleCentres);

  // Optimistic per-plan status overrides, keyed by plan id.
  const [overrides, setOverrides] = useState<Record<string, PlanStatus>>({});
  const [error, setError] = useState<BoardError | null>(null);
  // A drop into "Submitted" awaiting confirmation (card not yet moved).
  const [pending, setPending] = useState<PendingSubmit | null>(null);
  // The card currently being dragged — drives the DragOverlay (the lifted card
  // that follows the cursor) and the drop-target placeholder in each column.
  const [activeCard, setActiveCard] = useState<PlanCard | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const effectiveStatus = (card: PlanCard): PlanStatus => overrides[card.planId] ?? card.status;

  const byStatus = groupByStatus(cards, effectiveStatus);

  // Coordinator board: four read-only columns, no drag board, no "Not started".
  if (readOnly) {
    return (
      <div className="grid grid-cols-4 items-start gap-[14px]">
        {REAL_STATUS_COLUMNS.map((status) => (
          <ReadOnlyStatusColumn key={status} status={status} cards={byStatus[status]} />
        ))}
      </div>
    );
  }

  /**
   * Optimistically move a card to `target`, persisting via `persist`. On failure
   * (or rejection) roll the override back to `previous` and surface the error.
   * `errorPlanId` is set only on the submit path, so its toast can link to the
   * plan (a missing objective can't be fixed by dragging).
   */
  const commitMove = (
    planId: string,
    previous: PlanStatus,
    target: PlanStatus,
    persist: () => Promise<{ ok: boolean; error?: string }>,
    errorPlanId: string | null,
  ) => {
    setError(null);
    setOverrides((prev) => ({ ...prev, [planId]: target }));

    persist()
      .then((res) => {
        if (!res.ok) {
          setOverrides((prev) => ({ ...prev, [planId]: previous }));
          setError({ text: res.error ?? t('statusView.statusError'), planId: errorPlanId });
        }
      })
      .catch(() => {
        setOverrides((prev) => ({ ...prev, [planId]: previous }));
        setError({ text: t('statusView.statusError'), planId: errorPlanId });
      });
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveCard((event.active.data.current?.card as PlanCard | undefined) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const card = active.data.current?.card as PlanCard | undefined;
    if (!card) return;

    const target = over.id as PlanStatus;
    const previous = overrides[card.planId] ?? card.status;
    if (target === previous) return;

    // Any drop into "Submitted" is a real submission (first submit from In
    // progress, or resubmit from Needs Review): hold it, confirm, then route
    // through the editor's submit action. Every other transition keeps its
    // direct status write, unconfirmed.
    if (target === 'submitted') {
      setPending({ card, from: previous });
      return;
    }

    commitMove(card.planId, previous, target, () => setPlanStatus(card.planId, target), null);
  };

  // Confirm the held submission: optimistically move to Submitted and run the
  // same validation + write the editor's Submit uses. On the objective failure
  // the toast links back to the plan so the teacher can add it there.
  const confirmSubmit = () => {
    if (!pending) return;
    const { card, from } = pending;
    setPending(null);
    commitMove(card.planId, from, 'submitted', () => submitLessonPlanById(card.planId), card.planId);
  };

  return (
    <div>
      {error ? (
        <div className="mb-[12px] rounded-[10px] border border-status-review-bg bg-status-review-bg px-[12px] py-[8px] text-[12.5px] text-status-review">
          {error.text}
          {error.planId ? (
            <>
              {' '}
              <a
                href={`/plan/${error.planId}`}
                className="font-semibold underline underline-offset-2 hover:text-status-review"
              >
                {t('statusView.openPlan')}
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveCard(null)}
      >
        <div className="grid grid-cols-5 items-start gap-[14px]">
          {STATUS_COLUMN_ORDER.map((status) =>
            status === 'not_started' ? (
              <NotStartedColumn key={status} cards={empties} />
            ) : (
              <StatusColumn
                key={status}
                status={status}
                cards={byStatus[status]}
                activeStatus={activeCard ? effectiveStatus(activeCard) : null}
              />
            ),
          )}
        </div>
        {/* The lifted card follows the cursor instead of stacking on a resident
            card; the source card stays behind as a dimmed ghost. */}
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="cursor-grabbing rounded-[14px] shadow-lg">
              <StatusLessonCard card={activeCard} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pending ? (
        <SubmitForApprovalModal
          year={pending.card.year}
          onConfirm={confirmSubmit}
          onCancel={() => setPending(null)}
        />
      ) : null}
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
  const t = useTranslations('board');
  const locale = useLocale();
  return (
    <div className="mb-[10px] flex items-center justify-between gap-2 border-b border-border pb-[10px]">
      <span className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-ink">
        <StatusDot status={status} size={8} />
        {t(`status.${status}`)}
      </span>
      <span className="text-[11.5px] font-semibold text-text-muted">
        {formatNumber(count, locale)}
      </span>
    </div>
  );
}

/** The dashed placeholder a status column shows when it holds no cards. */
function EmptyColumn() {
  const t = useTranslations('board');
  return (
    <div className="rounded-[14px] border border-dashed border-border-strong px-[12px] py-[26px] text-center text-[11.5px] text-text-faint">
      {t('statusView.none')}
    </div>
  );
}

/**
 * The "Not started" column — grouped by class (subject, year) as a stack of
 * collapsible group cards (see NotStartedGroups), each showing "N to plan". Never a
 * drop target; a row opens the scope chooser rather than dragging.
 */
function NotStartedColumn({ cards }: { cards: EmptySlotCard[] }) {
  return (
    <div>
      <ColumnHeader status="not_started" count={cards.length} />
      {cards.length === 0 ? <EmptyColumn /> : <NotStartedGroups cards={cards} />}
    </div>
  );
}

/** A card-sized dashed outline marking where the dragged card will land. */
function DropPlaceholder() {
  return (
    <div
      aria-hidden
      className="min-h-[92px] rounded-[14px] border-2 border-dashed border-teal bg-teal-tint"
    />
  );
}

/** A real-status column: a drop target whose cards are draggable. */
function StatusColumn({
  status,
  cards,
  activeStatus,
}: {
  status: PlanStatus;
  cards: PlanCard[];
  /** The effective status of the card being dragged (null when idle). */
  activeStatus: PlanStatus | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  // Show drop feedback only when hovering a column the card would actually move
  // to — never its own source column, where a drop is a no-op.
  const showDropTarget = isOver && activeStatus !== null && activeStatus !== status;

  return (
    <div>
      <ColumnHeader status={status} count={cards.length} />
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[64px] flex-col gap-2 rounded-[10px] transition-colors',
          showDropTarget && 'bg-teal-tint/50 ring-2 ring-inset ring-teal',
        )}
      >
        {cards.map((card) => (
          <DraggableStatusCard key={card.key} card={card} />
        ))}
        {/* The placeholder makes the target obvious even when a card already
            occupies the column (the resident card no longer gets stacked on). */}
        {showDropTarget ? <DropPlaceholder /> : null}
        {cards.length === 0 && !showDropTarget ? <EmptyColumn /> : null}
      </div>
    </div>
  );
}

/** A read-only status column for the coordinator board: a header and static,
 *  non-draggable cards that open the review view. Never a drop target. */
function ReadOnlyStatusColumn({
  status,
  cards,
}: {
  status: PlanStatus;
  cards: PlanCard[];
}) {
  return (
    <div>
      <ColumnHeader status={status} count={cards.length} />
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <StatusLessonCard key={card.key} card={card} readOnly />
        ))}
        {cards.length === 0 ? <EmptyColumn /> : null}
      </div>
    </div>
  );
}

/** A status card wrapped as a @dnd-kit draggable, still a click-through link. */
function DraggableStatusCard({ card }: { card: PlanCard }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: card.planId,
    data: { card },
  });

  // dnd-kit fires a synthetic click on the card when the pointer lifts, even after
  // a real drag — which would follow the card's <Link> into the editor. Remember
  // that a drag happened and swallow the click that immediately follows it, then
  // clear the guard so a later genuine click still opens the plan.
  const draggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true;
    } else if (draggedRef.current) {
      const id = window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [isDragging]);

  const suppressClickAfterDrag = (event: ReactMouseEvent) => {
    if (draggedRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      onClickCapture={suppressClickAfterDrag}
      // The lifted copy lives in the DragOverlay; leave the source in place as a
      // dimmed ghost so the column doesn't reflow while dragging.
      className={cn('cursor-grab', isDragging && 'cursor-grabbing opacity-40')}
    >
      <StatusLessonCard card={card} />
    </div>
  );
}
