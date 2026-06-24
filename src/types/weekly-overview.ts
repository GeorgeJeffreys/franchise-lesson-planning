// View-model types for the curriculum-driven planning board. These describe the
// shape the data layer (src/lib/weekly-overview.ts) returns and the Calendar /
// Status views render.
//
// The board is anchored on CURRICULUM coordinates (month · week · period), not on
// calendar dates. For each year the signed-in teacher teaches, every curriculum
// period (P1..P5) of the selected (month, week) is a slot; the plans covering a
// slot — at any scope the teacher can see — render as cards over it.

import type { PlanScope, PlanStatus } from '@/types/lesson';

/**
 * What a slot/column shows as its status. The four stored `PlanStatus` values
 * plus the derived `not_started` (no plan of any scope covers the slot yet).
 */
export type SlotStatus = PlanStatus | 'not_started';

/** The owner of a plan — for the "whose plan" avatar and the people filter. */
export interface PlanOwner {
  id: string;
  name: string;
  initials: string;
}

/**
 * One plan covering a curriculum slot, trimmed to what the board needs. Several
 * plans (at different scopes / owners) can cover the same slot.
 */
export interface SlotPlan {
  id: string;
  status: PlanStatus;
  /** Plan scope — drives the Class / Centre / All centres chip. */
  scope: PlanScope;
  /** Who created the plan (avatar + people filter). Null on legacy rows. */
  owner: PlanOwner | null;
  /**
   * Whether the signed-in user may edit this plan (its creator, a coordinator of
   * its space, or an admin). Drives editable-wizard vs read-only-view routing.
   */
  canEdit: boolean;
  /** Coordinator note when returned (`needs_review`); null otherwise. */
  reviewNote: string | null;
}

/** One curriculum period slot (P1..P5) for a given year + (month, week). */
export interface BoardSlot {
  /** The `curriculum_lesson.lesson_key` for this (subject, year, month, week, period). */
  lessonKey: string;
  /** Curriculum year (0–6) this slot belongs to. */
  year: number;
  /** Day-of-week period (1–5). P1 = Mon … P5 = Fri. */
  period: number;
  /** Daily learning outcome (stem-cleaned). The slot headline. */
  dailyOutcome: string;
  /** Focus area / linguistic skill, e.g. "Reading". May be empty. */
  focusArea: string;
  /** Every plan (any scope) covering this slot. Empty → "Not started". */
  plans: SlotPlan[];
}

/** One year section: the years a teacher teaches each get their own band. */
export interface BoardYear {
  year: number;
  /** The curriculum period slots (P1..P5) for the selected (month, week). */
  slots: BoardSlot[];
}

/** A curriculum (month, week) position the prev/next arrows step through. */
export interface BoardCoordinate {
  month: string;
  week: number;
}

/** Everything the planning board renders for the selected curriculum week. */
export interface BoardData {
  /** The signed-in teacher's display name. */
  teacherName: string;
  /** "Centre · Subject" context line, derived from the teacher's classes. */
  context: string | null;
  /** The subject the board is showing (English first). */
  subjectName: string;
  /** The selected curriculum coordinate. */
  coordinate: BoardCoordinate;
  /** Human label for the coordinate, e.g. "March · Week 2". */
  coordinateLabel: string;
  /** The previous coordinate (or null at the start of the scheme of work). */
  prev: BoardCoordinate | null;
  /** The next coordinate (or null at the end of the scheme of work). */
  next: BoardCoordinate | null;
  /** One band per year the teacher teaches, in ascending year order. */
  years: BoardYear[];
  /** Distinct plan owners across the visible plans — the people-filter options. */
  owners: PlanOwner[];
  /** Total plans (any status/scope) visible for this coordinate. */
  planCount: number;
  /** False when the teacher teaches no classes yet (calm empty state). */
  hasClasses: boolean;
  /**
   * The teacher's own classes (via `class_teachers`) in the board subject, keyed
   * by year — drives the "My class" choice in the scope chooser. A year with more
   * than one entry lets the teacher pick which class.
   */
  myClassesByYear: Record<number, BoardClass[]>;
}

/** A class the teacher teaches, for the scope chooser's "My class" option. */
export interface BoardClass {
  id: string;
  /** Display label, e.g. "Year 2 · A". */
  label: string;
}
