// Shared derivation for the board's two views. A board is years × period slots;
// each slot carries the plans (any scope) covering it. The Status view wants a
// flat list of plan cards and a flat list of empty ("Not started") slots; the
// Calendar view reads the year/slot structure directly.

import type { PlanScope, PlanStatus } from '@/types/lesson';
import type { BoardYear, PlanOwner } from '@/types/weekly-overview';

/** One plan as a board card (Calendar cell + Status column). */
export interface PlanCard {
  /** Stable key — the plan id. */
  key: string;
  planId: string;
  /** Board subject (English first) — the card's muted subtitle line. */
  subject: string;
  year: number;
  period: number;
  status: PlanStatus;
  scope: PlanScope;
  owner: PlanOwner | null;
  /** Whether the viewer may edit (drives editable-wizard vs read-only routing). */
  canEdit: boolean;
  reviewNote: string | null;
}

/** A curriculum slot with no plan of any scope — a "Not started" card. */
export interface EmptySlotCard {
  /** Stable key — the slot's lesson key. */
  key: string;
  lessonKey: string;
  /** Board subject (English first) — the card's muted subtitle line. */
  subject: string;
  year: number;
  period: number;
  dailyOutcome: string;
  focusArea: string;
}

/**
 * Every plan card across the board, optionally filtered to one owner. The owner
 * filter hides only plan cards — it never turns a covered slot back into "Not
 * started" (a slot leaves Not started for everyone once any plan exists).
 */
export function planCardsForYears(
  years: BoardYear[],
  ownerId: string | null,
  subject: string,
): PlanCard[] {
  const out: PlanCard[] = [];
  for (const band of years) {
    for (const slot of band.slots) {
      for (const p of slot.plans) {
        if (ownerId && p.owner?.id !== ownerId) continue;
        out.push({
          key: p.id,
          planId: p.id,
          subject,
          year: slot.year,
          period: slot.period,
          status: p.status,
          scope: p.scope,
          owner: p.owner,
          canEdit: p.canEdit,
          reviewNote: p.reviewNote,
        });
      }
    }
  }
  return out;
}

/** Slots with no plan of any scope (always unfiltered) → "Not started" cards. */
export function emptySlotCards(years: BoardYear[], subject: string): EmptySlotCard[] {
  const out: EmptySlotCard[] = [];
  for (const band of years) {
    for (const slot of band.slots) {
      if (slot.plans.length > 0) continue;
      out.push({
        key: slot.lessonKey,
        lessonKey: slot.lessonKey,
        subject,
        year: slot.year,
        period: slot.period,
        dailyOutcome: slot.dailyOutcome,
        focusArea: slot.focusArea,
      });
    }
  }
  return out;
}
