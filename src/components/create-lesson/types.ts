// Shared, client-safe types for curriculum navigation. Imported by both the
// curriculum query layer and the board, so this module must stay free of any
// server-only imports (no Supabase, no `server-only`).

/** A month with its available curriculum week numbers, for the week nav. */
export interface MonthNav {
  month: string;
  weeks: number[];
}

/** One curriculum period cell for a (subject, year, month, week). */
export interface PickerCell {
  /** Day-of-week period (1–5). P1 = Mon … P5 = Fri. */
  period: number;
  /** The `curriculum_lesson.lesson_key` written into a new plan. */
  lessonKey: string;
  /** Daily learning outcome (stem-cleaned). */
  dailyOutcome: string;
  /** Focus area / linguistic skill, e.g. "Reading". */
  focusArea: string;
}
