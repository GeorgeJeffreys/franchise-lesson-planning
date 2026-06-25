// View-model the PDF components render from.
//
// This is deliberately decoupled from the `lesson_plans` row shape so the
// documents depend on a stable, presentational contract rather than the DB. It
// mirrors what the editor already resolves (plan + class + curriculum) and
// leaves explicit, optional slots for data that isn't on lesson_plans yet —
// attached resources, required materials, and a worksheet — so those can be
// populated later by extending the loader, with no change to the components'
// public shape.

import type { LessonPlan } from '@/types/lesson';

/** Class identity shown in the PDF header. */
export interface PdfClassContext {
  year: number;
  schoolName: string;
  subjectName: string;
}

/** Curriculum target resolved from `curriculum_lesson_id` (flat-file lookup). */
export interface PdfCurriculumContext {
  dailyLO: string;
  /** Focus area = the curriculum's linguistic skill (e.g. "Reading"). */
  focusArea: string;
  theme: string;
}

/**
 * A future-facing attachment slot. Nothing populates this today; the documents
 * render it only when present, so the loader can start supplying resources,
 * materials, or a worksheet reference without a component rewrite.
 */
export interface PdfAttachment {
  label: string;
  detail?: string;
}

/** Everything one lesson-plan page needs, fully self-contained. */
export interface PlanPdfModel {
  plan: LessonPlan;
  classContext: PdfClassContext;
  curriculum: PdfCurriculumContext | null;
  /** Resources/materials attached to the whole plan (reserved; empty today). */
  attachments?: PdfAttachment[];
  /** A worksheet reference for the plan (reserved; absent today). */
  worksheet?: PdfAttachment;
}
