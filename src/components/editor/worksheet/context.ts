// The real lesson/curriculum/class context the worksheet builder needs.
//
// Everything here is sourced from `EditorPlanData` (see @/lib/editor/load-plan)
// and threaded down from `LessonPlanEditor`. The MASTER half drives the locked
// (cream, read-only) page frame; the GENERATE half is the curriculum payload
// for `POST /api/generate-resource`; the IDS half scopes persistence, the bank
// modal, and usage tracking.

import type { ClassLiteracy } from '@/lib/editor/load-plan';

export interface WorksheetContext {
  // ── Master frame (locked, read-only) ──────────────────────────────────────
  /** Subject name from the lesson's subject space (NOT profiles.subject_id). */
  subjectName: string;
  /** Curriculum year from the class. */
  year: number | null;
  /** Theme from the curriculum lesson. */
  theme: string;
  /** Daily learning outcome from the curriculum lesson (stem-cleaned). */
  dailyOutcome: string;
  /** Centre name, from the school. */
  centreName: string;
  /** Curriculum lesson code, shown on the footer. */
  lessonCode: string;
  /** Exit-ticket prompt, sourced from the Step 4 exit_ticket block when present. */
  exitTicket: string;

  // ── Generate-with-AI payload (curriculum context) ─────────────────────────
  /** Week-level knowledge objective. */
  weeklyOutcome: string;
  /** Combined grammar + vocabulary focus. */
  grammarVocab: string;
  /** Class literacy flag for the generator. */
  literacy: ClassLiteracy;

  // ── Ids / scoping ─────────────────────────────────────────────────────────
  /** The lesson plan id — for `recordUsage` and (future) image paths. */
  lessonPlanId: string;
  /** The subject id — scopes the resource bank modal. */
  subjectId: string | null;
}
